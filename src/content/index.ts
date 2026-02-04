import type { AppSettings, TemplateRule } from '@/types/template'
import { SETTINGS_KEY, STORAGE_KEY, defaultSettings, defaultTemplates } from '@/types/template'

const LOG_PREFIX = '[Auto Confirm Helper]'
function logDebug(message: string, data?: unknown): void {
  if (data !== undefined) {
    console.log(LOG_PREFIX, message, data)
  } else {
    console.log(LOG_PREFIX, message)
  }
}

// 获取模板列表
async function getTemplates(): Promise<TemplateRule[]> {
  return new Promise((resolve) => {
    chrome.storage.sync.get([STORAGE_KEY], (result) => {
      if (result[STORAGE_KEY]) {
        logDebug('Loaded templates from storage', { count: (result[STORAGE_KEY] as TemplateRule[]).length })
        resolve(result[STORAGE_KEY] as TemplateRule[])
      } else {
        logDebug('No templates found in storage, using defaults', { count: defaultTemplates.length })
        resolve(defaultTemplates)
      }
    })
  })
}

// 获取设置
async function getSettings(): Promise<AppSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get([SETTINGS_KEY], (result) => {
      if (result[SETTINGS_KEY]) {
        logDebug('Loaded settings from storage', result[SETTINGS_KEY] as AppSettings)
        resolve(result[SETTINGS_KEY] as AppSettings)
      } else {
        logDebug('No settings found in storage, using defaults', defaultSettings)
        resolve(defaultSettings)
      }
    })
  })
}

// 检查URL是否匹配模式
function matchUrlPattern(url: string, pattern: string): boolean {
  if (!pattern) return true
  // 将通配符转换为正则表达式
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
  return new RegExp(regexPattern, 'i').test(url)
}

// 检查页面是否包含指定文本
function normalizeText(text: string): string {
  return text.replace(/\s+/g, '').trim()
}

function containsText(texts?: string[]): boolean {
  if (!texts || texts.length === 0) return true
  const pageText = document.body.innerText || document.body.textContent || ''
  const normalizedPage = normalizeText(pageText)
  const result = texts.every((text) => normalizedPage.includes(normalizeText(text)))
  logDebug('Text match result', { texts, result })
  return result
}

// 查找匹配的输入框
function findMatchingInput(template: TemplateRule): HTMLElement | null {
  const { matcher } = template
  const inputs = document.querySelectorAll(
    'input[type="text"], input:not([type]), input[type="search"], textarea, [contenteditable="true"]'
  )

  logDebug('Scanning inputs', { total: inputs.length, template: template.name })

  for (const input of inputs) {
    const inputEl = input as HTMLElement
    
    // 检查placeholder匹配
    if (matcher.placeholderPattern && inputEl instanceof HTMLInputElement) {
      const placeholder = inputEl.placeholder || ''
      if (!normalizeText(placeholder).includes(normalizeText(matcher.placeholderPattern))) {
        continue
      }
    }

    // 检查input class匹配
    if (matcher.inputClassPattern) {
      if (!inputEl.className.includes(matcher.inputClassPattern)) {
        continue
      }
    }

    // 检查容器class匹配
    if (matcher.containerClassPattern) {
      const container = inputEl.closest(`.${matcher.containerClassPattern}`)
      if (!container) {
        // 尝试查找父元素中包含该class的元素
        let parent = inputEl.parentElement
        let found = false
        while (parent) {
          if (parent.className && parent.className.includes(matcher.containerClassPattern)) {
            found = true
            break
          }
          parent = parent.parentElement
        }
        if (!found) continue
      }
    }

    logDebug('Found matching input for template', { template: template.name })
    // 如果所有条件都满足，返回这个输入框
    return inputEl
  }

  return null
}

function isFillableInput(input: HTMLElement): boolean {
  if (input instanceof HTMLInputElement) {
    if (input.disabled || input.readOnly) return false
    const type = (input.getAttribute('type') || 'text').toLowerCase()
    if (type === 'password' || type === 'email' || type === 'number') return false
    return true
  }
  if (input instanceof HTMLTextAreaElement) {
    if (input.disabled || input.readOnly) return false
    return true
  }
  if (input.getAttribute('contenteditable') === 'true') return true
  return false
}

function findDialogContainer(input: HTMLElement): HTMLElement | null {
  const dialogSelectors = [
    '[role="dialog"]',
    '[aria-modal="true"]',
    '.dialog',
    '.modal',
    '.ant-modal',
    '.el-dialog',
    '.ivu-modal',
    '.arco-modal',
    '.t-dialog',
  ]
  return input.closest(dialogSelectors.join(','))
}

function getLabelText(input: HTMLElement): string | null {
  if (!(input instanceof HTMLInputElement)) return null
  if (input.getAttribute('aria-label')) {
    return input.getAttribute('aria-label')
  }

  if (input.labels && input.labels.length > 0 && input.labels[0]) {
    return input.labels[0].textContent?.trim() || null
  }

  const id = input.getAttribute('id')
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`)
    if (label) return label.textContent?.trim() || null
  }

  const parentLabel = input.closest('label')
  if (parentLabel) return parentLabel.textContent?.trim() || null

  return null
}

function extractQuotedText(text: string): string | null {
  const quoteMatch = text.match(/[“"「『](.+?)[”"」』]/)
  if (quoteMatch && quoteMatch[1]) {
    return quoteMatch[1].trim()
  }
  return null
}

function extractFromDialogPattern(text: string): string | null {
  const patterns = [
    /请输入[:：]?\s*([^\s，。]+?)(?=[，。\n]|$)/,
    /请填写[:：]?\s*([^\s，。]+?)(?=[，。\n]|$)/,
    /请输入\s*“(.+?)”/,
    /请输入\s*"(.+?)"/,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  return null
}

function pickDialogText(input: HTMLElement): string {
  const container = findDialogContainer(input)
  const text = container?.innerText || document.body.innerText
  return text || ''
}

function tryGenericEngines(input: HTMLElement, settings: AppSettings): string | null {
  if (!isFillableInput(input)) return null
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    if (input.value) return null
  } else if (input.textContent && input.textContent.trim()) {
    return null
  }

  if (settings.genericEngines.placeholder && input instanceof HTMLInputElement) {
    const placeholder = input.placeholder?.trim()
    if (placeholder && placeholder.length >= 2) return placeholder
  }

  if (settings.genericEngines.label) {
    const label = getLabelText(input)
    if (label) {
      const extracted = extractQuotedText(label) || extractFromDialogPattern(label)
      if (extracted) return extracted
    }
  }

  const dialogText = pickDialogText(input)

  if (settings.genericEngines.quotedText) {
    const quoted = extractQuotedText(dialogText)
    if (quoted) return quoted
  }

  if (settings.genericEngines.dialogPattern) {
    const extracted = extractFromDialogPattern(dialogText)
    if (extracted) return extracted
  }

  return null
}

// 模拟用户输入 - 使用多种策略确保兼容各种框架
function simulateUserInput(input: HTMLElement, value: string): boolean {
  // 先聚焦输入框
  input.focus()
  
  // 策略1: 尝试使用 execCommand (模拟粘贴，最接近真实用户操作)
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    // 选中所有内容
    input.select()
    
    // 尝试使用 execCommand 插入文本（模拟粘贴）
    try {
      // 先清空
      if (document.execCommand('selectAll', false)) {
        if (document.execCommand('insertText', false, value)) {
          logDebug('Used execCommand insertText')
          return true
        }
      }
    } catch (e) {
      logDebug('execCommand failed, trying other methods')
    }
  }
  
  // 策略2: 使用 native setter + InputEvent (React/Vue 兼容方案)
  if (input instanceof HTMLInputElement) {
    try {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, value)
        // 创建带有 inputType 的 InputEvent，更接近真实输入
        const inputEvent = new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: value,
        })
        input.dispatchEvent(inputEvent)
        logDebug('Used nativeInputValueSetter for HTMLInputElement')
        return true
      }
    } catch (e) {
      logDebug('nativeInputValueSetter failed for input', e)
    }
  }
  
  if (input instanceof HTMLTextAreaElement) {
    try {
      const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set
      if (nativeTextAreaValueSetter) {
        nativeTextAreaValueSetter.call(input, value)
        const inputEvent = new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: value,
        })
        input.dispatchEvent(inputEvent)
        logDebug('Used nativeTextAreaValueSetter for HTMLTextAreaElement')
        return true
      }
    } catch (e) {
      logDebug('nativeTextAreaValueSetter failed for textarea', e)
    }
  }
  
  // 策略3: contenteditable 元素
  if (input.getAttribute('contenteditable') === 'true') {
    // 选中所有内容
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(input)
    selection?.removeAllRanges()
    selection?.addRange(range)
    
    // 使用 execCommand
    try {
      if (document.execCommand('insertText', false, value)) {
        logDebug('Used execCommand for contenteditable')
        return true
      }
    } catch (e) {
      // fallback: 直接设置 textContent
      input.textContent = value
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }))
      return true
    }
  }
  
  return false
}

// 触发完整的事件序列，模拟真实用户交互
function triggerFullEventSequence(input: HTMLElement, value: string): void {
  // 模拟 focus
  input.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
  input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  
  // 模拟键盘事件序列
  for (const char of value) {
    input.dispatchEvent(new KeyboardEvent('keydown', { 
      bubbles: true, 
      key: char,
      code: `Key${char.toUpperCase()}`,
    }))
    input.dispatchEvent(new KeyboardEvent('keypress', { 
      bubbles: true, 
      key: char,
    }))
    input.dispatchEvent(new KeyboardEvent('keyup', { 
      bubbles: true, 
      key: char,
    }))
  }
  
  // 触发 input 和 change 事件
  input.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: value,
  }))
  
  input.dispatchEvent(new Event('change', { bubbles: true }))
  
  // 模拟 blur (有些框架在 blur 时才更新状态)
  setTimeout(() => {
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  }, 50)
}

// 尝试直接调用 React/Vue 的事件处理器
function tryReactVueDirectCall(input: HTMLElement, value: string): boolean {
  // 查找 React 的内部属性
  const inputAny = input as unknown as Record<string, unknown>
  const reactPropsKey = Object.keys(input).find(
    key => key.startsWith('__reactProps$') || key.startsWith('__reactEventHandlers$')
  )
  
  if (reactPropsKey) {
    try {
      const reactProps = inputAny[reactPropsKey] as Record<string, unknown>
      if (reactProps && typeof reactProps.onChange === 'function') {
        // 设置值
        if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
          input.value = value
        }
        // 创建模拟事件对象
        const syntheticEvent = {
          target: input,
          currentTarget: input,
          type: 'change',
          bubbles: true,
          preventDefault: () => {},
          stopPropagation: () => {},
          nativeEvent: new Event('change'),
        }
        ;(reactProps.onChange as (e: unknown) => void)(syntheticEvent)
        logDebug('Called React onChange directly')
        return true
      }
    } catch (e) {
      logDebug('React direct call failed', e)
    }
  }
  
  // 查找 Vue 的 __vue__ 实例
  const vueKey = Object.keys(input).find(key => key.startsWith('__vue'))
  if (vueKey) {
    logDebug('Vue instance found, using standard events')
  }
  
  return false
}

// 填写输入框 - 综合使用多种策略
function fillInput(input: HTMLElement, value: string): void {
  logDebug('Filling input', { value, tagName: input.tagName, className: input.className })
  
  // 方法1: 模拟真实用户输入
  let success = simulateUserInput(input, value)
  
  // 方法2: 如果模拟输入失败，尝试直接调用框架的事件处理器
  if (!success) {
    success = tryReactVueDirectCall(input, value)
  }
  
  // 方法3: 降级到直接设置值 + 事件触发
  if (!success) {
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      input.value = value
    } else {
      input.textContent = value
    }
    triggerFullEventSequence(input, value)
    logDebug('Used fallback method')
  }
  
  // 额外触发事件序列确保框架检测到变化
  triggerFullEventSequence(input, value)
  
  // 添加视觉反馈
  const originalBorder = input.style.border
  const originalOutline = input.style.outline
  input.style.border = '2px solid #4CAF50'
  input.style.outline = 'none'
  setTimeout(() => {
    input.style.border = originalBorder
    input.style.outline = originalOutline
  }, 1000)

  console.log(`[Auto Confirm Helper] 已填写: ${value}`)
}

// 主函数：扫描并填写
async function scanAndFill(): Promise<void> {
  const [templates, settings] = await Promise.all([getTemplates(), getSettings()])
  const currentUrl = window.location.href
  logDebug('Scan start', { url: currentUrl, templates: templates.length })

  for (const template of templates) {
    // 跳过禁用的模板
    if (!template.enabled) continue

    // 检查URL匹配
    if (template.matcher.urlPattern && !matchUrlPattern(currentUrl, template.matcher.urlPattern)) {
      logDebug('Template URL mismatch', { template: template.name, pattern: template.matcher.urlPattern })
      continue
    }

    // 检查页面文本
    if (!containsText(template.matcher.containsText)) {
      logDebug('Template text mismatch', { template: template.name, texts: template.matcher.containsText })
      continue
    }

    // 查找匹配的输入框
    const input = findMatchingInput(template)
    if (input && isFillableInput(input)) {
      // 只有当输入框为空时才填写
      const value = template.fillValue
      if (value) {
        fillInput(input, value)
        logDebug('Template filled', { template: template.name })
        cancelRetry() // 成功后取消重试
        return
      }
      // 模板填充值为空时，尝试通用引擎
      const genericValue = tryGenericEngines(input, settings)
      if (genericValue) {
        fillInput(input, genericValue)
        logDebug('Generic engine used for template', { template: template.name })
        cancelRetry() // 成功后取消重试
        return
      }
    }
  }

  // 如果没有模板匹配，尝试通用引擎 - 使用增强的输入框查找
  const inputs = findAllInputs()
  logDebug('Found inputs for generic engine', { count: inputs.length })
  
  for (const inputEl of inputs) {
    const genericValue = tryGenericEngines(inputEl, settings)
    if (genericValue) {
      fillInput(inputEl, genericValue)
      logDebug('Generic engine auto matched')
      cancelRetry() // 成功后取消重试
      return
    }
  }

  logDebug('Scan complete: no match')
}

let retryTimer: number | null = null
let retryCount = 0
const MAX_RETRIES = 10

function scheduleRetry(): void {
  if (retryTimer) return
  retryCount = 0
  retryTimer = window.setInterval(() => {
    retryCount += 1
    scanAndFill()
    if (retryCount >= MAX_RETRIES && retryTimer) {
      clearInterval(retryTimer)
      retryTimer = null
      retryCount = 0
    }
  }, 500)
}

function cancelRetry(): void {
  if (retryTimer) {
    clearInterval(retryTimer)
    retryTimer = null
    retryCount = 0
  }
}

// 防抖函数
function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: number | null = null
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = window.setTimeout(() => {
      fn(...args)
      timer = null
    }, delay)
  }
}

// 检测是否是对话框/弹窗元素
function isDialogElement(element: Element): boolean {
  const dialogSelectors = [
    '[role="dialog"]',
    '[role="alertdialog"]',
    '[aria-modal="true"]',
    '.dialog',
    '.modal',
    '.popup',
    '.overlay',
    // Ant Design
    '.ant-modal',
    '.ant-drawer',
    '.ant-popconfirm',
    // Element UI / Element Plus
    '.el-dialog',
    '.el-drawer',
    '.el-message-box',
    '.el-popconfirm',
    // iView / View UI
    '.ivu-modal',
    '.ivu-drawer',
    // Arco Design
    '.arco-modal',
    '.arco-drawer',
    // TDesign
    '.t-dialog',
    '.t-drawer',
    '.t-popup',
    // 腾讯云控制台特定
    '.tc-dialog',
    '.tea-dialog',
    '.tea-modal',
    '.cds-modal',
    '.confirm-dialog',
    '[class*="dialog"]',
    '[class*="modal"]',
    '[class*="Dialog"]',
    '[class*="Modal"]',
  ]
  
  return dialogSelectors.some(selector => {
    try {
      return element.matches(selector) || element.querySelector(selector) !== null
    } catch {
      return false
    }
  })
}

// 检测 Shadow DOM
function queryShadowRoot(root: Element | ShadowRoot, selector: string): Element[] {
  const results: Element[] = []
  
  try {
    results.push(...Array.from(root.querySelectorAll(selector)))
  } catch {
    // ignore
  }
  
  // 递归查找 Shadow DOM
  const allElements = root.querySelectorAll('*')
  for (const el of allElements) {
    if (el.shadowRoot) {
      results.push(...queryShadowRoot(el.shadowRoot, selector))
    }
  }
  
  return results
}

// 增强的输入框查找 - 支持 Shadow DOM 和更多选择器
function findAllInputs(): HTMLElement[] {
  const selectors = [
    'input[type="text"]',
    'input:not([type])',
    'input[type="search"]',
    'textarea',
    '[contenteditable="true"]',
    '[contenteditable=""]',
    // 一些自定义输入组件
    '[role="textbox"]',
    '[class*="input"]',
    '[class*="Input"]',
  ]
  
  const allInputs: HTMLElement[] = []
  const seen = new WeakSet<Element>()
  
  for (const selector of selectors) {
    try {
      // 普通 DOM
      const elements = document.querySelectorAll(selector)
      for (const el of elements) {
        if (!seen.has(el) && el instanceof HTMLElement) {
          seen.add(el)
          allInputs.push(el)
        }
      }
      
      // Shadow DOM
      const shadowElements = queryShadowRoot(document.body, selector)
      for (const el of shadowElements) {
        if (!seen.has(el) && el instanceof HTMLElement) {
          seen.add(el)
          allInputs.push(el)
        }
      }
    } catch {
      // ignore invalid selectors
    }
  }
  
  // 过滤掉不可见和不可编辑的元素
  return allInputs.filter(input => {
    const style = window.getComputedStyle(input)
    const isVisible = style.display !== 'none' && 
                      style.visibility !== 'hidden' && 
                      style.opacity !== '0' &&
                      input.offsetParent !== null
    
    // 检查是否是真正的输入元素
    const isRealInput = input instanceof HTMLInputElement || 
                        input instanceof HTMLTextAreaElement ||
                        input.getAttribute('contenteditable') === 'true' ||
                        input.getAttribute('contenteditable') === '' ||
                        input.getAttribute('role') === 'textbox'
    
    return isVisible && isRealInput
  })
}

// 使用MutationObserver监听DOM变化 - 增强版
function observeDOM(): void {
  const debouncedScan = debounce(() => {
    scanAndFill()
    scheduleRetry()
  }, 200)
  
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false
    
    for (const mutation of mutations) {
      // 检测新增节点
      if (mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            // 检测是否是对话框或包含输入框
            if (isDialogElement(node) || 
                node.querySelector('input, textarea, [contenteditable]') ||
                node.matches?.('input, textarea, [contenteditable]')) {
              shouldScan = true
              break
            }
          }
        }
      }
      
      // 检测属性变化（有些框架通过 display/visibility 控制弹窗）
      if (mutation.type === 'attributes') {
        const target = mutation.target as Element
        if (mutation.attributeName === 'style' || 
            mutation.attributeName === 'class' ||
            mutation.attributeName === 'aria-hidden' ||
            mutation.attributeName === 'hidden') {
          if (isDialogElement(target)) {
            shouldScan = true
          }
        }
      }
      
      if (shouldScan) break
    }
    
    if (shouldScan) {
      // 延迟执行，等待 DOM 完全渲染
      setTimeout(() => debouncedScan(), 100)
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'aria-hidden', 'hidden'],
  })
  
  // 额外监听 document，处理 body 外的弹窗
  observer.observe(document.documentElement, {
    childList: true,
  })
  
  logDebug('DOM observer started with enhanced detection')
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'triggerFill') {
    logDebug('Manual trigger received')
    scanAndFill()
    sendResponse({ success: true })
  }
  if (message.action === 'pageLoaded') {
    logDebug('Page loaded trigger received')
    scanAndFill()
    scheduleRetry()
  }
  if (message.action === 'ping') {
    sendResponse({ ok: true })
  }
  return true
})

// 初始化
function init(): void {
  logDebug('Content script loaded')
  
  // 首次扫描
  setTimeout(scanAndFill, 500)
  
  // 开始监听DOM变化
  observeDOM()
}

// 等待DOM加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
