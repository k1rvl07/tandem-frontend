import type { Directive } from 'vue'

function resize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

const autosize: Directive<HTMLTextAreaElement> = {
  mounted(el) {
    el.style.resize = 'none'
    el.style.overflowY = 'hidden'
    requestAnimationFrame(() => resize(el))
  },
  updated(el) {
    resize(el)
  },
}

export default autosize
