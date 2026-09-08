import { expect, test } from './fixtures'

test('updates the profile display name and restores it', async ({ page }) => {
  await page.goto('/profile')
  const field = page.locator('#display_name')
  await expect(field).toBeVisible()
  const original = await field.inputValue()
  const name = `e2e-name-${Date.now()}`
  await field.fill(name)
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(field).toHaveValue(name)
  await field.fill(original)
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(field).toHaveValue(original)
})
