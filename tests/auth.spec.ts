import { test, expect, Page } from '@playwright/test';

// Pre-created test user in Supabase
const TEST_EMAIL = 'playwright@papelitos.app';
const TEST_PASSWORD = 'Test123456';

/** Helper: log in and navigate to menu */
async function loginAndGoToMenu(page: Page) {
  await page.goto('/');
  await expect(page.getByText('INICIAR SESIÓN')).toBeVisible({ timeout: 15000 });
  await page.getByText('INICIAR SESIÓN').click();
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.getByText('SIGUIENTE').click();
  await expect(page).toHaveURL(/\/menu/, { timeout: 15000 });
}

test.describe('Auth flow', () => {
  test('login with existing user reaches menu', async ({ page }) => {
    await loginAndGoToMenu(page);
    await expect(page.getByRole('button', { name: /ESCANEAR TAREAS/ })).toBeVisible({ timeout: 5000 });
    await page.getByText('Cerrar sesión').click();
    await page.waitForURL('/', { timeout: 10000 });
    await expect(page.getByText('INICIAR SESIÓN')).toBeVisible({ timeout: 10000 });
  });

  test('register new user auto-logins without email confirmation', async ({ page }) => {
    const newEmail = `test_${Date.now()}@papelitos.app`;
    await page.goto('/');
    await expect(page.getByText('CREAR CUENTA')).toBeVisible({ timeout: 15000 });
    await page.getByText('CREAR CUENTA').click();
    await page.fill('input[type="email"]', newEmail);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.getByText('GUARDAR').click();

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
        test.skip(true, 'Supabase rate limit');
        return;
      }
      expect(errText).not.toContain('confirm');
      expect(errText).not.toContain('Cuenta creada pero no se pudo iniciar');
      throw new Error(`Registration failed: ${errText}`);
    }

    while (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(500);
    }
    if (await startBtn.isVisible().catch(() => false)) await startBtn.click();
    if (await skipBtn.isVisible().catch(() => false)) await skipBtn.click();
    await expect(page).toHaveURL(/\/menu/, { timeout: 15000 });
  });

  test('login with wrong credentials shows error', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('INICIAR SESIÓN')).toBeVisible({ timeout: 15000 });
    await page.getByText('INICIAR SESIÓN').click();
    await page.fill('input[type="email"]', 'noexiste@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.getByText('SIGUIENTE').click();
    await expect(page.getByText('Email o contraseña incorrectos')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('User management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToMenu(page);
    await page.getByText('GESTIONAR USUARIOS').click();
    await expect(page.getByText('Listado de Usuarios')).toBeVisible({ timeout: 10000 });
  });

  test('add user saves successfully (no schema cache error)', async ({ page }) => {
    const testName = `TestUser_${Date.now()}`;
    await page.getByRole('button', { name: '+ Añadir Usuario' }).click();
    await expect(page.getByRole('heading', { name: 'Añadir Usuario' })).toBeVisible();
    const modal = page.locator('.fixed.inset-0');
    await modal.locator('input[type="text"]').fill(testName);
    await modal.locator('input[type="number"]').fill('8');
    await modal.getByText('Guardar').click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText(testName)).toBeVisible({ timeout: 5000 });
    const errorEl = page.locator('.text-red-500');
    if (await errorEl.isVisible().catch(() => false)) {
      const errText = await errorEl.textContent() || '';
      expect(errText).not.toContain('schema cache');
    }
    page.on('dialog', dialog => dialog.accept());
    const row = page.locator('tr', { hasText: testName });
    await row.locator('button', { hasText: '🗑️' }).click();
    await page.waitForTimeout(1000);
  });
});

test.describe('Reward management', () => {
  test('reward list loads without schema cache error', async ({ page }) => {
    await loginAndGoToMenu(page);
    await page.getByText('GESTIONAR RECOMPENSAS').click();
    await expect(page.getByText('Gestionar Recompensas')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table')).toBeVisible({ timeout: 5000 });
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('schema cache');
  });

  test('add reward saves without schema cache error', async ({ page }) => {
    await loginAndGoToMenu(page);
    await page.getByText('GESTIONAR RECOMPENSAS').click();
    await expect(page.getByText('Gestionar Recompensas')).toBeVisible({ timeout: 10000 });
    await page.getByText('+ Añadir Recompensa').click();
    await expect(page.getByText('Crear Recompensa')).toBeVisible({ timeout: 10000 });
    const rewardName = `TestReward_${Date.now()}`;
    await page.locator('input[type="text"]').first().fill(rewardName);
    await page.locator('select').filter({ hasText: 'Personal' }).selectOption('comun');
    await page.locator('input[type="number"]').first().fill('100');
    await page.getByText('GUARDAR').click();
    await expect(page).toHaveURL(/\/recompensas/, { timeout: 10000 });
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).not.toContain('schema cache');
  });
});

test.describe('Task management', () => {
  test('task list loads without schema cache error', async ({ page }) => {
    await loginAndGoToMenu(page);
    await page.getByText('GESTIONAR TAREAS').click();
    await expect(page.getByText('Gestionar Tareas')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table')).toBeVisible({ timeout: 5000 });
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('schema cache');
  });
});

test.describe('Inicio de Día', () => {
  test('inicio de día runs without definicion_tareas schema error', async ({ page }) => {
    await loginAndGoToMenu(page);
    await page.getByText('INICIO DE DÍA').click();
    await expect(page.getByText('Generando...')).toBeVisible();
    const messageBox = page.locator('.bg-white.shadow');
    await expect(messageBox).toBeVisible({ timeout: 15000 });
    const messageText = await messageBox.textContent() || '';
    expect(messageText).not.toContain('schema cache');
  });
});

test.describe('Configuration', () => {
  test('save print schedule without ajustes table error', async ({ page }) => {
    await loginAndGoToMenu(page);
    await page.getByText('CONFIGURACIÓN').click();
    await expect(page.getByText('Configuración')).toBeVisible({ timeout: 10000 });
    await page.locator('input[type="time"]').first().fill('09:00');
    await page.locator('input[type="time"]').last().fill('17:00');
    await page.getByText('GUARDAR CONFIGURACIÓN').click();
    await page.waitForTimeout(3000);
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).not.toContain('schema cache');
    expect(bodyText).toContain('Configuración guardada');
  });

  test('bluetooth button is visible and clickable', async ({ page }) => {
    await loginAndGoToMenu(page);
    await page.getByText('CONFIGURACIÓN').click();
    await expect(page.getByText('Configuración')).toBeVisible({ timeout: 10000 });
    const btButton = page.getByText('Conectar Impresora Bluetooth');
    await expect(btButton).toBeVisible();
    await expect(btButton).toBeEnabled();
  });
});
