// 模板规则接口
export interface TemplateRule {
  id: string
  name: string
  description: string
  enabled: boolean
  // 匹配条件
  matcher: {
    // URL匹配模式（支持通配符）
    urlPattern?: string
    // 包含的文本关键词（用于检测对话框内容）
    containsText?: string[]
    // input的placeholder匹配
    placeholderPattern?: string
    // input的class匹配
    inputClassPattern?: string
    // 父容器的class匹配
    containerClassPattern?: string
  }
  // 要填写的值
  fillValue: string
  // 创建时间
  createdAt: number
  // 更新时间
  updatedAt: number
}

export interface AppSettings {
  genericEngines: {
    placeholder: boolean
    label: boolean
    quotedText: boolean
    dialogPattern: boolean
  }
  update: {
    releasesUrl: string
  }
}

// 默认模板列表
export const defaultTemplates: TemplateRule[] = [
  {
    id: 'tencent-cloud-delete-key',
    name: '腾讯云-删除密钥确认',
    description: '腾讯云控制台删除API密钥时的确认输入框',
    enabled: true,
    matcher: {
      containsText: ['删除此密钥后无法再恢复', '腾讯云将永久拒绝此密钥的所有请求'],
      placeholderPattern: '已知晓删除密钥后无法再恢复并确认删除',
      inputClassPattern: 'app-cam-input',
      containerClassPattern: 'app-cam-dialog__body',
    },
    fillValue: '已知晓删除密钥后无法再恢复并确认删除',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'tencent-cloud-delete-resource',
    name: '腾讯云-删除资源确认',
    description: '腾讯云控制台删除资源时的通用确认',
    enabled: true,
    matcher: {
      containsText: ['确认删除'],
      placeholderPattern: '确认删除',
    },
    fillValue: '确认删除',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'aliyun-delete-confirm',
    name: '阿里云-删除确认',
    description: '阿里云控制台删除资源确认',
    enabled: true,
    matcher: {
      urlPattern: '*aliyun.com*',
      containsText: ['请输入', '确认删除'],
    },
    fillValue: '确认删除',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'github-delete-repo',
    name: 'GitHub-删除仓库确认',
    description: 'GitHub删除仓库时需要输入仓库名',
    enabled: true,
    matcher: {
      urlPattern: '*github.com*',
      containsText: ['delete this repository', 'please type'],
    },
    fillValue: '', // 需要动态获取仓库名
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

// 存储键名
export const STORAGE_KEY = 'auto_confirm_templates'
export const SETTINGS_KEY = 'auto_confirm_settings'

// 写死的 Releases 地址
export const RELEASES_URL = 'https://github.com/xinxinsuried/suried-auto-confirm-input-helper/releases'

export const defaultSettings: AppSettings = {
  genericEngines: {
    placeholder: true,
    label: true,
    quotedText: true,
    dialogPattern: true,
  },
  update: {
    releasesUrl: RELEASES_URL,
  },
}
