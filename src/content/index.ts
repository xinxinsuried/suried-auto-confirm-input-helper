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

// 填写输入框
function fillInput(input: HTMLElement, value: string): void {
  logDebug('Filling input', { value })
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
    input.value = value
  } else {
    input.textContent = value
  }
  
  // 触发各种事件以确保Vue/React等框架能够捕获到变化
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))
  
  // 添加视觉反馈
  const originalBorder = input.style.border
  input.style.border = '2px solid #4CAF50'
  setTimeout(() => {
    input.style.border = originalBorder
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
        return
      }
      // 模板填充值为空时，尝试通用引擎
      const genericValue = tryGenericEngines(input, settings)
      if (genericValue) {
        fillInput(input, genericValue)
        logDebug('Generic engine used for template', { template: template.name })
        return
      }
    }
  }

  // 如果没有模板匹配，尝试通用引擎
  const inputs = document.querySelectorAll(
    'input[type="text"], input:not([type]), input[type="search"], textarea, [contenteditable="true"]'
  )
  for (const input of inputs) {
    const inputEl = input as HTMLElement
    const genericValue = tryGenericEngines(inputEl, settings)
    if (genericValue) {
      fillInput(inputEl, genericValue)
      logDebug('Generic engine auto matched')
      return
    }
  }

  logDebug('Scan complete: no match')
}

let retryTimer: number | null = null
function scheduleRetry(): void {
  if (retryTimer) return
  let count = 0
  retryTimer = window.setInterval(() => {
    count += 1
    scanAndFill()
    if (count >= 5 && retryTimer) {
      clearInterval(retryTimer)
      retryTimer = null
    }
  }, 400)
}

// 使用MutationObserver监听DOM变化
function observeDOM(): void {
  const observer = new MutationObserver((mutations) => {
    // 检测是否有新的对话框出现
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        // 延迟执行，等待DOM完全渲染
        setTimeout(scanAndFill, 300)
        scheduleRetry()
        break
      }
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })
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
