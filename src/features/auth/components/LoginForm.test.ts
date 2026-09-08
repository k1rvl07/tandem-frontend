import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LoginForm from './LoginForm.vue'

function mountForm(props: Record<string, unknown> = {}) {
  return mount(LoginForm, {
    props,
    attachTo: document.body,
  })
}

describe('LoginForm', () => {
  it('emits trimmed credentials on valid submit', async () => {
    const wrapper = mountForm()
    await wrapper.find('#login').setValue('  ivanov.ii  ')
    await wrapper.find('#password').setValue('secret')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')).toEqual([[{ login: 'ivanov.ii', password: 'secret' }]])
    wrapper.unmount()
  })

  it('shows validation errors and does not submit', async () => {
    const wrapper = mountForm()
    await wrapper.find('#login').setValue('ab')
    await wrapper.find('#password').setValue('')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('login must be at least 3 characters')
    expect(wrapper.text()).toContain('password is required')
    wrapper.unmount()
  })

  it('clears a field error while typing', async () => {
    const wrapper = mountForm()
    await wrapper.find('#login').setValue('ab')
    await wrapper.find('#password').setValue('x')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('login must be at least 3 characters')
    await wrapper.find('#login').setValue('ivanov.ii')
    expect(wrapper.text()).not.toContain('login must be at least 3 characters')
    wrapper.unmount()
  })

  it('renders the custom submit label', () => {
    const wrapper = mountForm({ submitLabel: 'Sign in', disabled: true })
    expect(wrapper.find('button[type="submit"]').text()).toBe('Sign in')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
