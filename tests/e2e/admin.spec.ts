import { expect, test } from './fixtures'

test('searches for a user in the admin panel', async ({ page }) => {
  await page.goto('/admin')
  const search = page.getByPlaceholder('Search by login')
  await expect(search).toBeVisible()
  await search.fill('admin')
  await expect(page.locator('tbody')).toContainText('admin')
})
