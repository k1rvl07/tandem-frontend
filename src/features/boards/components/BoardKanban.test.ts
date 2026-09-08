import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  BoardDetail,
  Column,
  Task,
  TaskAttachment,
  TaskDetail,
  WorkspaceDetail,
  WorkspaceMember,
} from '@/shared/types'
import { makeToken } from '@/test/tokens'
import BoardKanban from './BoardKanban.vue'

type WsHandler = (msg: { type: string; data?: unknown }) => void

const apiMocks = vi.hoisted(() => ({
  boards: {
    getBoard: vi.fn(),
    listBoards: vi.fn(),
    getTaskDetail: vi.fn(),
    listAttachments: vi.fn(),
    listWorkspaceTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    createAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
  },
  workspaces: { getWorkspace: vi.fn() },
  ws: {
    connect: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    on: vi.fn(),
  },
  http: { get: vi.fn() },
  files: { uploadImage: vi.fn(), getSignedUrl: vi.fn() },
}))

vi.mock('@/features/boards/api', () => apiMocks.boards)
vi.mock('@/features/workspaces/api', () => apiMocks.workspaces)
vi.mock('@/api/ws', () => ({ useWS: () => apiMocks.ws }))
vi.mock('@/api/http', () => ({
  http: apiMocks.http,
  HTTP_ERROR_EVENT: 'tandem:http-error',
  UNAUTHORIZED_EVENT: 'tandem:unauthorized',
}))
vi.mock('@/api/files', () => apiMocks.files)
vi.mock('vue-draggable-plus', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    VueDraggable: defineComponent({
      name: 'VueDraggable',
      props: { modelValue: { type: Array }, group: { type: [Object, String], default: null } },
      setup(_, { slots }) {
        return () => h('div', slots.default?.())
      },
    }),
  }
})

const member: WorkspaceMember = {
  id: 'u1',
  login: 'ivanov.ii',
  display_name: 'Ivan',
  avatar_key: '',
  role: 'member',
  joined_at: '2026-01-01T00:00:00Z',
}

const workspace: WorkspaceDetail = {
  id: 'ws1',
  name: 'My Workspace',
  prefix: 'WS',
  description: '',
  theme: 'default',
  role: 'editor',
  is_favorite: false,
  members: [member],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function task(id: string, title: string, isHidden = false): Task {
  return {
    id,
    display_id: `WS-${id.slice(1)}`,
    title,
    description: '',
    workspace_id: 'ws1',
    board_id: 'b1',
    board_name: 'Board',
    column_id: 'c1',
    column_name: 'Backlog',
    author: null,
    assignee: null,
    curator: null,
    parent_id: '',
    due_date: null,
    position: 0,
    is_urgent: false,
    is_hidden: isHidden,
    image_key: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

const taskDetail: TaskDetail = {
  ...task('t1', 'Fix bugs'),
  parent: null,
  subtasks: [],
}

const column: Column = {
  id: 'c1',
  board_id: 'b1',
  name: 'Backlog',
  position: 0,
  task_count: 2,
  tasks: [task('t1', 'Fix bugs'), task('t2', 'Secret task', true)],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const board: BoardDetail = {
  id: 'b1',
  workspace_id: 'ws1',
  name: 'Board',
  position: 0,
  is_main: true,
  columns: [column],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const attachment: TaskAttachment = {
  id: 'att1',
  task_id: 't1',
  filename: 'cover.png',
  content_type: 'image/png',
  url: 'http://localhost:8080/files/cover.png',
  size: 1024,
  uploaded_by: 'u1',
  created_at: '2026-01-01T00:00:00Z',
}

const subscribers = new Map<string, Set<WsHandler>>()

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  subscribers.clear()
  setActivePinia(createPinia())
  localStorage.setItem('tandem_token', makeToken())
  localStorage.setItem('tandem_user', JSON.stringify(member))
  apiMocks.ws.on.mockImplementation((type: string, handler: WsHandler) => {
    let set = subscribers.get(type)
    if (!set) {
      set = new Set<WsHandler>()
      subscribers.set(type, set)
    }
    set.add(handler)
    return () => {
      set?.delete(handler)
    }
  })
  apiMocks.workspaces.getWorkspace.mockResolvedValue(workspace)
  apiMocks.boards.getBoard.mockResolvedValue(board)
  apiMocks.boards.listBoards.mockResolvedValue([])
  apiMocks.boards.listWorkspaceTasks.mockResolvedValue([
    task('t1', 'Fix bugs'),
    task('t2', 'Secret task', true),
  ])
  apiMocks.boards.getTaskDetail.mockResolvedValue(taskDetail)
  apiMocks.boards.listAttachments.mockResolvedValue([])
  apiMocks.http.get.mockResolvedValue({ data: new Blob(['x']) })
})

async function mountKanban(): Promise<VueWrapper> {
  const wrapper = mount(BoardKanban, {
    props: { workspaceId: 'ws1', boardId: 'b1' },
    global: { plugins: [createPinia()] },
  })
  await flushPromises()
  return wrapper
}

function emitSafe(type: string, data: unknown) {
  const handlers = subscribers.get(type)
  for (const handler of handlers ?? []) {
    handler({ type, data })
  }
}

describe('BoardKanban', () => {
  it('renders hidden tasks with transparency and strikethrough', async () => {
    const wrapper = await mountKanban()
    const hidden = wrapper.find('[data-task-id="t2"]')
    expect(hidden.exists()).toBe(true)
    expect(hidden.classes()).toContain('opacity-60')
    const title = hidden.find('p')
    expect(title.classes()).toContain('line-through')
    wrapper.unmount()
  })

  it('does not duplicate attachments when the same created event arrives twice', async () => {
    const wrapper = await mountKanban()
    await wrapper.find('[data-task-id="t1"]').trigger('click')
    await flushPromises()

    emitSafe('attachment.created', attachment)
    await flushPromises()
    emitSafe('attachment.created', attachment)
    await flushPromises()

    const anchors = wrapper.findAll('a[target="_blank"]')
    expect(anchors).toHaveLength(1)
    expect(anchors[0].find('img').attributes('alt')).toBe('cover.png')
    wrapper.unmount()
  })

  it('ignores attachment.created when it does not belong to the open task', async () => {
    const wrapper = await mountKanban()
    await wrapper.find('[data-task-id="t1"]').trigger('click')
    await flushPromises()

    emitSafe('attachment.created', { ...attachment, task_id: 't2', id: 'att2' })
    await flushPromises()

    expect(wrapper.findAll('a[target="_blank"]')).toHaveLength(0)
    wrapper.unmount()
  })

  it('removes attachment from the editor when attachment.deleted arrives', async () => {
    apiMocks.boards.listAttachments.mockResolvedValue([attachment])
    const wrapper = await mountKanban()
    await wrapper.find('[data-task-id="t1"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('a[target="_blank"]')).toHaveLength(1)

    emitSafe('attachment.deleted', { id: 'att1' })
    await flushPromises()

    expect(wrapper.findAll('a[target="_blank"]')).toHaveLength(0)
    wrapper.unmount()
  })

  it('joins the workspace room and subscribes to events on mount', async () => {
    const wrapper = await mountKanban()
    expect(apiMocks.ws.connect).toHaveBeenCalledTimes(1)
    expect(apiMocks.ws.join).toHaveBeenCalledWith('workspace:ws1')
    for (const type of [
      'presence',
      'task.created',
      'task.updated',
      'task.deleted',
      'attachment.created',
      'attachment.deleted',
    ]) {
      expect(apiMocks.ws.on).toHaveBeenCalledWith(type, expect.any(Function))
    }
    wrapper.unmount()
  })
})
