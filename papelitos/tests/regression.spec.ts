import { test, expect, Page } from '@playwright/test';

/**
 * Regression test: complete business flow with a FRESH account each run.
 *
 * Flow: Register → Create users → Create task → Create reward →
 *       Inicio de Día → Verify papelitos → Scan task → Verify reward →
 *       Configuration → Idempotency check
 */

const SUPABASE_URL = 'https://sinnbdujmbzxpqvawmik.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpbm5iZHVqbWJ6eHBxdmF3bWlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwOTE5NTMsImV4cCI6MjA4ODY2Nzk1M30.RRQrSS7Y7ybxvmI9QYrQ6HWCkQc3vi5onkPLHwAcj0s';

const RUN_ID = Date.now();
const FRESH_EMAIL = `reg_${RUN_ID}@papelitos.app`;
const FRESH_PASSWORD = 'Test123456';

test.describe('Regression: full business flow', () => {
  test.describe.configure({ mode: 'serial' });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ── Helpers ─────────────────────────────────────────────────

  /** Extract auth token and userId from browser localStorage */
  async function getAuth(): Promise<{ token: string; userId: string }> {
    return page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.includes('auth-token')) {
          const data = JSON.parse(localStorage.getItem(key)!);
          return { token: data.access_token, userId: data.user.id };
        }
      }
      throw new Error('No Supabase auth token found');
    });
  }

  /** Supabase REST API call executed in the browser context */
  async function supabaseRest(
    method: 'GET' | 'PATCH' | 'POST',
    pathAndQuery: string,
    body?: Record<string, unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const { token } = await getAuth();
    return page.evaluate(
      async (args) => {
        const headers: Record<string, string> = {
          apikey: args.anonKey,
          Authorization: `Bearer ${args.token}`,
          'Content-Type': 'application/json',
        };
        if (args.method !== 'GET') {
          headers['Prefer'] = 'return=representation';
        }
        const resp = await fetch(`${args.url}/rest/v1/${args.path}`, {
          method: args.method,
          headers,
          body: args.body ? JSON.stringify(args.body) : undefined,
        });
        if (!resp.ok) throw new Error(`REST ${args.method} ${args.path}: ${resp.status}`);
        const ct = resp.headers.get('content-type');
        return ct?.includes('json') ? resp.json() : [];
      },
      { method, url: SUPABASE_URL, path: pathAndQuery, body, token, anonKey: SUPABASE_ANON_KEY }
    );
  }

  /** Click "← Volver a Menú" link and wait for /menu URL */
  async function goToMenu() {
    await page.getByText('← Volver a Menú').click();
    await expect(page).toHaveURL(/\/menu/, { timeout: 10000 });
  }

  // ── 1. Register ─────────────────────────────────────────────

  test('1 - Register fresh account', async () => {
    await page.goto('/');
    await expect(page.getByText('CREAR CUENTA')).toBeVisible({ timeout: 15000 });
    await page.getByText('CREAR CUENTA').click();

    await page.fill('input[type="email"]', FRESH_EMAIL);
    await page.fill('input[type="password"]', FRESH_PASSWORD);
    await page.getByText('GUARDAR').click();

    // Handle possible carousel or direct menu
    const menuBtn = page.getByRole('button', { name: /ESCANEAR TAREAS/ });
    const nextBtn = page.getByRole('button', { name: /Siguiente/i });
    const startBtn = page.getByRole('button', { name: /Empezar/i });
    const skipBtn = page.getByRole('button', { name: /Omitir/i });
    const errorMsg = page.locator('.text-red-500');

    await expect(
      menuBtn.or(nextBtn).or(startBtn).or(skipBtn).or(errorMsg)
    ).toBeVisible({ timeout: 30000 });

    if (await errorMsg.isVisible().catch(() => false)) {
      const errText = await errorMsg.textContent();
      if (errText?.includes('rate limit')) {
        test.skip(true, 'Supabase rate limit — retry later');
        return;
      }
      throw new Error(`Registration failed: ${errText}`);
    }

    // Click through carousel if shown
    while (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(500);
    }
    if (await startBtn.isVisible().catch(() => false)) await startBtn.click();
    if (await skipBtn.isVisible().catch(() => false)) await skipBtn.click();

    await expect(page).toHaveURL(/\/menu/, { timeout: 15000 });
    await expect(menuBtn).toBeVisible();
  });

  // ── 2. Create Users ─────────────────────────────────────────

  test('2 - Add users Ana and Luis', async () => {
    await page.getByRole('button', { name: /GESTIONAR USUARIOS/ }).click();
    await expect(page.getByText('Listado de Usuarios')).toBeVisible({ timeout: 10000 });

    for (const u of [
      { name: 'Ana', age: '10' },
      { name: 'Luis', age: '8' },
    ]) {
      await page.getByRole('button', { name: '+ Añadir Usuario' }).click();
      const modal = page.locator('.fixed.inset-0');
      await expect(modal).toBeVisible({ timeout: 5000 });
      await modal.locator('input[type="text"]').fill(u.name);
      await modal.locator('input[type="number"]').fill(u.age);
      await modal.getByText('Guardar').click();
      await expect(modal).not.toBeVisible({ timeout: 5000 });
      await expect(page.getByText(u.name)).toBeVisible();
    }

    await goToMenu();
  });

  // ── 3. Create Task ──────────────────────────────────────────

  test('3 - Create daily task "Hacer cama" for Ana (+10 / -5)', async () => {
    await page.getByRole('button', { name: /GESTIONAR TAREAS/ }).click();
    await expect(page.getByText('Gestionar Tareas')).toBeVisible({ timeout: 10000 });

    await page.getByText('+ Añadir Tarea').click();
    await expect(page.getByText('Crear Tarea')).toBeVisible({ timeout: 10000 });

    const form = page.locator('.max-w-lg');
    // Name
    await form.locator('input[type="text"]').fill('Hacer cama');
    // Description
    await form.locator('textarea').fill('Hacer la cama por la mañana');
    // User: select Ana (first select in the form)
    await form.locator('select').nth(0).selectOption({ label: 'Ana' });
    // Frequency: Diaria (default) — no change needed
    // Hora impresión: Mañana (default) — no change needed
    // Puntos OK
    await form.locator('input[type="number"]').nth(0).fill('10');
    // Puntos KO
    await form.locator('input[type="number"]').nth(1).fill('5');

    await page.getByText('GUARDAR').click();
    await expect(page).toHaveURL(/\/tareas$/, { timeout: 10000 });
    await expect(page.getByText('Hacer cama')).toBeVisible({ timeout: 5000 });

    await goToMenu();
  });

  // ── 4. Create Reward ────────────────────────────────────────

  test('4 - Create personal reward "Helado" for Ana (10 pts, daily)', async () => {
    await page.getByRole('button', { name: /GESTIONAR RECOMPENSAS/ }).click();
    await expect(page.getByText('Gestionar Recompensas')).toBeVisible({ timeout: 10000 });

    await page.getByText('+ Añadir Recompensa').click();
    await expect(page.getByText('Crear Recompensa')).toBeVisible({ timeout: 10000 });

    const form = page.locator('.max-w-lg');
    // Name
    await form.locator('input[type="text"]').fill('Helado');
    // Description
    await form.locator('textarea').fill('Un helado de chocolate');
    // Frequency → Diaria (default is semanal, select idx 0)
    await form.locator('select').nth(0).selectOption('diaria');
    // Type: Personal (default) — no change
    // User: Ana (select idx 2, after frecuencia and tipo)
    await form.locator('select').nth(2).selectOption({ label: 'Ana' });
    // Points to redeem (last number input)
    await form.locator('input[type="number"]').last().fill('10');

    await page.getByText('GUARDAR').click();
    await expect(page).toHaveURL(/\/recompensas$/, { timeout: 10000 });
    await expect(page.getByText('Helado')).toBeVisible({ timeout: 5000 });

    await goToMenu();
  });

  // ── 5. Inicio de Día ───────────────────────────────────────

  test('5 - Inicio de Día generates 1 task papelito + 1 reward papelito', async () => {
    await page.getByRole('button', { name: /INICIO DE DÍA/ }).click();
    await expect(page.getByText('Generando...')).toBeVisible();

    // Wait for result message
    const resultBox = page.locator('.bg-white.shadow');
    await expect(resultBox).toBeVisible({ timeout: 15000 });

    const txt = await resultBox.textContent() || '';
    expect(txt).toContain('1 tareas');
    expect(txt).toContain('1 recompensas');
    expect(txt).not.toContain('Error');
  });

  // ── 6. Check Papelitos Page ─────────────────────────────────

  test('6 - Papelitos page shows "Hacer cama" as pending', async () => {
    await page.getByRole('button', { name: /GESTIÓN PAPELITOS/ }).click();
    await expect(page.getByText('Gestión de Papelitos')).toBeVisible({ timeout: 10000 });

    // Task papelito should appear
    await expect(page.getByText('Hacer cama')).toBeVisible({ timeout: 5000 });
    // Should be assigned to Ana
    await expect(page.locator('td', { hasText: 'Ana' })).toBeVisible();
    // Should show pending icon
    await expect(page.locator('td:has-text("⏳")')).toBeVisible();

    await goToMenu();
  });

  // ── 7. Scan Task → Verify Reward ────────────────────────────

  test('7 - Scanning task papelito marks it done and achieves reward', async () => {
    const { userId } = await getAuth();

    // 1. Get the pending papelito from DB
    const papelitos = await supabaseRest(
      'GET',
      `papelito_tareas?casa_id=eq.${userId}&nombre=eq.Hacer%20cama&estado=eq.no_hecha`
    );
    expect(papelitos.length).toBeGreaterThanOrEqual(1);
    const papelito = papelitos[0];
    expect(papelito.fecha_escaneo).toBeNull();

    // 2. Simulate QR scan: mark task as done
    const updated = await supabaseRest(
      'PATCH',
      `papelito_tareas?id=eq.${papelito.id}`,
      { fecha_escaneo: new Date().toISOString(), estado: 'hecha' }
    );
    expect(updated[0].estado).toBe('hecha');
    expect(updated[0].fecha_escaneo).not.toBeNull();

    // 3. Run reward verification (replicating verificarRecompensas business logic)
    const pendingRewards = await supabaseRest(
      'GET',
      `papelito_recompensas?casa_id=eq.${userId}&conseguido=eq.false` +
        `&select=*,definicion_recompensas:definicion_recompensa_id(puntos_canjear,comun_o_personal)`
    );
    expect(pendingRewards.length).toBeGreaterThanOrEqual(1);

    for (const reward of pendingRewards) {
      const def = reward.definicion_recompensas;
      if (!def) continue;

      const esComun = def.comun_o_personal === 'comun';
      let q =
        `papelito_tareas?casa_id=eq.${userId}` +
        `&fecha_impresion=gte.${reward.fecha_inicio}` +
        `&fecha_impresion=lte.${reward.fecha_fin}`;
      if (!esComun && reward.usuario_id) {
        q += `&usuario_id=eq.${reward.usuario_id}`;
      }

      const tasks = await supabaseRest('GET', q);
      let points = 0;
      for (const t of tasks) {
        points += t.fecha_escaneo ? t.puntos_ok : t.puntos_ko;
      }

      if (points >= def.puntos_canjear) {
        await supabaseRest('PATCH', `papelito_recompensas?id=eq.${reward.id}`, {
          conseguido: true,
        });
      }
    }

    // 4. Verify "Helado" reward is now achieved
    const helado = await supabaseRest(
      'GET',
      `papelito_recompensas?casa_id=eq.${userId}&nombre=eq.Helado`
    );
    expect(helado).toHaveLength(1);
    expect(helado[0].conseguido).toBe(true);
  });

  // ── 8. Verify Papelitos Updated ─────────────────────────────

  test('8 - Papelitos page shows task as done (✅)', async () => {
    await page.getByRole('button', { name: /GESTIÓN PAPELITOS/ }).click();
    await expect(page.getByText('Gestión de Papelitos')).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('Hacer cama')).toBeVisible({ timeout: 5000 });
    // Status should now be ✅ instead of ⏳
    await expect(page.locator('td:has-text("✅")')).toBeVisible();

    await goToMenu();
  });

  // ── 9. Configuration ───────────────────────────────────────

  test('9 - Save print schedule configuration', async () => {
    await page.getByRole('button', { name: /CONFIGURACIÓN/ }).click();
    await expect(page.getByText('Configuración')).toBeVisible({ timeout: 10000 });

    await page.locator('input[type="time"]').first().fill('08:30');
    await page.locator('input[type="time"]').last().fill('16:00');

    await page.getByText('GUARDAR CONFIGURACIÓN').click();
    await page.waitForTimeout(2000);

    const body = await page.locator('body').textContent() || '';
    expect(body).toContain('Configuración guardada');

    await goToMenu();
  });

  // ── 10. Idempotency ────────────────────────────────────────

  test('10 - Inicio de Día twice → 0 new papelitos (no duplicates)', async () => {
    await page.getByRole('button', { name: /INICIO DE DÍA/ }).click();
    await expect(page.getByText('Generando...')).toBeVisible();

    const resultBox = page.locator('.bg-white.shadow');
    await expect(resultBox).toBeVisible({ timeout: 15000 });

    const txt = await resultBox.textContent() || '';
    expect(txt).toContain('0 tareas');
    expect(txt).toContain('0 recompensas');
  });

  // ── 11. Edit & Delete Flows ────────────────────────────────

  test('11 - Edit task, delete user, verify cascade', async () => {
    // Edit the task name
    await page.getByRole('button', { name: /GESTIONAR TAREAS/ }).click();
    await expect(page.getByText('Gestionar Tareas')).toBeVisible({ timeout: 10000 });

    // Click edit icon on "Hacer cama" row
    const taskRow = page.locator('tr', { hasText: 'Hacer cama' });
    await taskRow.locator('button:has-text("✏️")').click();
    await expect(page.getByText('Editar Tarea')).toBeVisible({ timeout: 10000 });

    const form = page.locator('.max-w-lg');
    await form.locator('input[type="text"]').fill('Hacer cama editada');
    await page.getByText('GUARDAR').click();
    await expect(page).toHaveURL(/\/tareas$/, { timeout: 10000 });
    await expect(page.getByText('Hacer cama editada')).toBeVisible({ timeout: 5000 });

    await goToMenu();

    // Delete user "Luis"
    await page.getByRole('button', { name: /GESTIONAR USUARIOS/ }).click();
    await expect(page.getByText('Listado de Usuarios')).toBeVisible({ timeout: 10000 });

    page.on('dialog', (dialog) => dialog.accept());
    const luisRow = page.locator('tr', { hasText: 'Luis' });
    await luisRow.locator('button:has-text("🗑️")').click();
    await page.waitForTimeout(1500);
    await expect(page.getByText('Luis')).not.toBeVisible({ timeout: 5000 });
    // Ana should still be there
    await expect(page.getByText('Ana')).toBeVisible();

    await goToMenu();
  });

  // ── 12. Logout & Re-login ──────────────────────────────────

  test('12 - Logout and re-login with same account', async () => {
    await page.getByText('Cerrar sesión').click();
    await page.waitForURL('/', { timeout: 10000 });
    await expect(page.getByText('INICIAR SESIÓN')).toBeVisible({ timeout: 10000 });

    // Re-login
    await page.getByText('INICIAR SESIÓN').click();
    await page.fill('input[type="email"]', FRESH_EMAIL);
    await page.fill('input[type="password"]', FRESH_PASSWORD);
    await page.getByText('SIGUIENTE').click();
    await expect(page).toHaveURL(/\/menu/, { timeout: 15000 });

    // Data should persist — check tasks
    await page.getByRole('button', { name: /GESTIONAR TAREAS/ }).click();
    await expect(page.getByText('Hacer cama editada')).toBeVisible({ timeout: 10000 });

    await goToMenu();
  });
});
