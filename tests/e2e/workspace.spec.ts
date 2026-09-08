import { expect, test } from './fixtures'

test('creates a workspace, adds a board and creates a task', async ({ page, api }) => {
  const wsName = api.name('ws')
  await page.goto('/')
  await expect(page.locator('[data-menu="profile"] > button')).toBeVisible()
  await page.getByRole('button', { name: 'Create workspace' }).click()
  await page.locator('#ws_name').fill(wsName)
  await page.locator('#ws_prefix').fill('E2E')
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  const card = page.locator('main div.flex.flex-wrap > div').filter({ hasText: wsName })
  await expect(card).toContainText(wsName)
  await card.locator('button').last().click()
  await expect(page).toHaveURL(/\/workspaces\/[0-9a-f-]+/)
  await expect(page.locator('h1')).toContainText(wsName)
  await expect(page.getByRole('button', { name: /Main/ }).first()).toBeVisible()
  await expect(page.getByText('Backlog', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Workspace settings' }).first().click()
  await page.getByRole('button', { name: 'Workspace settings', exact: true }).last().click()
  await page.getByRole('button', { name: 'Add new board' }).click()
  await page.getByPlaceholder('Board name').fill('Second board')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('button', { name: /Second board/ })).toBeVisible()

  await page.getByRole('button', { name: 'Create task' }).click()
  await page.locator('#task_title').fill('e2e task')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByText('e2e task')).toBeVisible()

  const id = (await api.listWorkspaces()).find((ws) => ws.name === wsName)?.id
  expect(id).toBeTruthy()
})
