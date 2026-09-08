import { expect, test } from './fixtures'

test('logs out and rejects invalid credentials', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-menu="profile"] > button')).toBeVisible()
  await page.locator('[data-menu="profile"] > button').first().click()
  await page.getByRole('button', { name: 'Logout' }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.locator('#login').fill('admin')
  await page.locator('#password').fill('definitely-wrong-password')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page.getByText('invalid credentials')).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test('logs in after logout', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-menu="profile"] > button').first().click()
  await page.getByRole('button', { name: 'Logout' }).click()
  await expect(page).toHaveURL(/\/login/)
  const login = process.env.E2E_ADMIN_LOGIN ?? 'admin'
  const password = process.env.E2E_ADMIN_PASSWORD ?? 'AdminPass123!'
  await page.locator('#login').fill(login)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page).toHaveURL('/')
  await expect(page.locator('[data-menu="profile"] > button')).toBeVisible()
})
