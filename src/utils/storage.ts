import type { AppSettings, TemplateRule } from '@/types/template'
import { defaultSettings, defaultTemplates, SETTINGS_KEY, STORAGE_KEY } from '@/types/template'

// 获取所有模板
export async function getTemplates(): Promise<TemplateRule[]> {
  return new Promise((resolve) => {
    chrome.storage.sync.get([STORAGE_KEY], (result) => {
      if (result[STORAGE_KEY]) {
        resolve(result[STORAGE_KEY] as TemplateRule[])
      } else {
        // 首次使用，初始化默认模板
        saveTemplates(defaultTemplates)
        resolve(defaultTemplates)
      }
    })
  })
}

// 获取设置
export async function getSettings(): Promise<AppSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get([SETTINGS_KEY], (result) => {
      if (result[SETTINGS_KEY]) {
        resolve(result[SETTINGS_KEY] as AppSettings)
      } else {
        saveSettings(defaultSettings)
        resolve(defaultSettings)
      }
    })
  })
}

// 保存设置
export async function saveSettings(settings: AppSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [SETTINGS_KEY]: settings }, () => {
      resolve()
    })
  })
}

// 保存所有模板
export async function saveTemplates(templates: TemplateRule[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: templates }, () => {
      resolve()
    })
  })
}

// 添加模板
export async function addTemplate(template: Omit<TemplateRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<TemplateRule> {
  const templates = await getTemplates()
  const newTemplate: TemplateRule = {
    ...template,
    id: `custom-${Date.now()}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  templates.push(newTemplate)
  await saveTemplates(templates)
  return newTemplate
}

// 更新模板
export async function updateTemplate(id: string, updates: Partial<TemplateRule>): Promise<void> {
  const templates = await getTemplates()
  const index = templates.findIndex((t) => t.id === id)
  if (index !== -1) {
    templates[index] = {
      ...templates[index],
      ...updates,
      updatedAt: Date.now(),
    } as TemplateRule
    await saveTemplates(templates)
  }
}

// 删除模板
export async function deleteTemplate(id: string): Promise<void> {
  const templates = await getTemplates()
  const filtered = templates.filter((t) => t.id !== id)
  await saveTemplates(filtered)
}

// 切换模板启用状态
export async function toggleTemplate(id: string): Promise<void> {
  const templates = await getTemplates()
  const template = templates.find((t) => t.id === id)
  if (template) {
    template.enabled = !template.enabled
    template.updatedAt = Date.now()
    await saveTemplates(templates)
  }
}

// 重置为默认模板
export async function resetToDefault(): Promise<void> {
  await saveTemplates(defaultTemplates)
}

// 生成唯一ID
export function generateId(): string {
  return `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
