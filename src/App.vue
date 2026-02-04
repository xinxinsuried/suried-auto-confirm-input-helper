<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { AppSettings, TemplateRule } from '@/types/template'
import { defaultSettings } from '@/types/template'
import {
  getTemplates,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  toggleTemplate,
  resetToDefault,
  getSettings,
  saveSettings,
} from '@/utils/storage'

const templates = ref<TemplateRule[]>([])
const showEditModal = ref(false)
const editingTemplate = ref<TemplateRule | null>(null)
const activeTab = ref<'list' | 'add' | 'settings'>('list')
const settings = ref<AppSettings>(defaultSettings)
const version = chrome.runtime.getManifest().version

// 新模板表单
const newTemplate = ref({
  name: '',
  description: '',
  enabled: true,
  matcher: {
    urlPattern: '',
    containsText: '',
    placeholderPattern: '',
    inputClassPattern: '',
    containerClassPattern: '',
  },
  fillValue: '',
})

// 加载模板
async function loadTemplates() {
  templates.value = await getTemplates()
}

async function loadSettings() {
  settings.value = await getSettings()
}

// 添加新模板
async function handleAddTemplate() {
  if (!newTemplate.value.name || !newTemplate.value.fillValue) {
    alert('请填写模板名称和填写值')
    return
  }

  await addTemplate({
    name: newTemplate.value.name,
    description: newTemplate.value.description,
    enabled: newTemplate.value.enabled,
    matcher: {
      urlPattern: newTemplate.value.matcher.urlPattern || undefined,
      containsText: newTemplate.value.matcher.containsText
        ? newTemplate.value.matcher.containsText.split('\n').filter(Boolean)
        : undefined,
      placeholderPattern: newTemplate.value.matcher.placeholderPattern || undefined,
      inputClassPattern: newTemplate.value.matcher.inputClassPattern || undefined,
      containerClassPattern: newTemplate.value.matcher.containerClassPattern || undefined,
    },
    fillValue: newTemplate.value.fillValue,
  })

  // 重置表单
  resetNewTemplate()
  await loadTemplates()
  activeTab.value = 'list'
}

// 重置新模板表单
function resetNewTemplate() {
  newTemplate.value = {
    name: '',
    description: '',
    enabled: true,
    matcher: {
      urlPattern: '',
      containsText: '',
      placeholderPattern: '',
      inputClassPattern: '',
      containerClassPattern: '',
    },
    fillValue: '',
  }
}

// 编辑模板
function startEdit(template: TemplateRule) {
  editingTemplate.value = { ...template }
  showEditModal.value = true
}

// 保存编辑
async function handleSaveEdit() {
  if (!editingTemplate.value) return

  await updateTemplate(editingTemplate.value.id, editingTemplate.value)
  showEditModal.value = false
  editingTemplate.value = null
  await loadTemplates()
}

// 删除模板
async function handleDelete(id: string) {
  if (confirm('确定要删除这个模板吗？')) {
    await deleteTemplate(id)
    await loadTemplates()
  }
}

// 切换启用状态
async function handleToggle(id: string) {
  await toggleTemplate(id)
  await loadTemplates()
}

// 重置为默认
async function handleReset() {
  if (confirm('确定要重置为默认模板吗？自定义模板将被删除。')) {
    await resetToDefault()
    await loadTemplates()
  }
}

// 手动触发填写
async function triggerFill() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'triggerFill' })
  }
}

onMounted(() => {
  loadTemplates()
  loadSettings()
})

async function handleSettingsChange() {
  await saveSettings(settings.value)
}

async function openReleases() {
  const url = settings.value.update.releasesUrl
  if (!url) {
    alert('请先在设置中填写更新地址（仓库 Releases 地址）')
    return
  }
  chrome.tabs.create({ url })
}

async function openExtensionsPage() {
  chrome.tabs.create({ url: 'chrome://extensions/' })
}
</script>

<template>
  <div class="w-[450px] min-h-[500px] bg-base-100" data-theme="light">
    <!-- Header -->
    <div class="navbar bg-primary text-primary-content px-4">
      <div class="flex-1">
        <span class="text-lg font-bold">🔧 自动确认填写助手</span>
      </div>
      <div class="flex-none">
        <button class="btn btn-ghost btn-sm" @click="triggerFill" title="立即触发填写">
          ▶️
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs tabs-boxed m-2">
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'list' }"
        @click="activeTab = 'list'"
      >
        📋 模板列表
      </a>
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'add' }"
        @click="activeTab = 'add'"
      >
        ➕ 添加模板
      </a>
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'settings' }"
        @click="activeTab = 'settings'"
      >
        ⚙️ 设置
      </a>
    </div>

    <!-- List Tab -->
    <div v-if="activeTab === 'list'" class="p-2 space-y-2 max-h-[380px] overflow-y-auto">
      <div v-if="templates.length === 0" class="text-center text-gray-500 py-8">
        暂无模板，请添加新模板
      </div>

      <div
        v-for="template in templates"
        :key="template.id"
        class="card bg-base-200 shadow-sm"
      >
        <div class="card-body p-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <input
                type="checkbox"
                class="toggle toggle-primary toggle-sm"
                :checked="template.enabled"
                @change="handleToggle(template.id)"
              />
              <h3 class="card-title text-sm">{{ template.name }}</h3>
            </div>
            <div class="flex gap-1">
              <button
                class="btn btn-ghost btn-xs"
                @click="startEdit(template)"
                title="编辑"
              >
                ✏️
              </button>
              <button
                class="btn btn-ghost btn-xs text-error"
                @click="handleDelete(template.id)"
                title="删除"
              >
                🗑️
              </button>
            </div>
          </div>
          <p class="text-xs text-gray-500">{{ template.description }}</p>
          <div class="text-xs bg-base-300 p-2 rounded mt-1">
            <span class="font-semibold">填写值：</span>
            <code class="text-primary">{{ template.fillValue }}</code>
          </div>
        </div>
      </div>

      <!-- Reset Button -->
      <div class="pt-2 border-t">
        <button class="btn btn-outline btn-sm btn-block" @click="handleReset">
          🔄 重置为默认模板
        </button>
      </div>
    </div>

    <!-- Add Tab -->
    <div v-if="activeTab === 'add'" class="p-3 space-y-3 max-h-[400px] overflow-y-auto">
      <div class="form-control">
        <label class="label">
          <span class="label-text font-semibold">模板名称 *</span>
        </label>
        <input
          v-model="newTemplate.name"
          type="text"
          placeholder="例如：腾讯云删除确认"
          class="input input-bordered input-sm w-full"
        />
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text font-semibold">描述</span>
        </label>
        <input
          v-model="newTemplate.description"
          type="text"
          placeholder="模板用途说明"
          class="input input-bordered input-sm w-full"
        />
      </div>

      <div class="divider text-xs">匹配条件（至少填一项）</div>

      <div class="form-control">
        <label class="label">
          <span class="label-text text-xs">URL匹配模式</span>
        </label>
        <input
          v-model="newTemplate.matcher.urlPattern"
          type="text"
          placeholder="例如：*cloud.tencent.com*"
          class="input input-bordered input-xs w-full"
        />
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text text-xs">包含文本（每行一个关键词）</span>
        </label>
        <textarea
          v-model="newTemplate.matcher.containsText"
          placeholder="删除此密钥后无法再恢复&#10;确认删除"
          class="textarea textarea-bordered textarea-xs w-full h-16"
        ></textarea>
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text text-xs">Input placeholder匹配</span>
        </label>
        <input
          v-model="newTemplate.matcher.placeholderPattern"
          type="text"
          placeholder="输入框的placeholder内容"
          class="input input-bordered input-xs w-full"
        />
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text text-xs">Input class匹配</span>
        </label>
        <input
          v-model="newTemplate.matcher.inputClassPattern"
          type="text"
          placeholder="例如：app-cam-input"
          class="input input-bordered input-xs w-full"
        />
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text text-xs">容器 class匹配</span>
        </label>
        <input
          v-model="newTemplate.matcher.containerClassPattern"
          type="text"
          placeholder="例如：app-cam-dialog__body"
          class="input input-bordered input-xs w-full"
        />
      </div>

      <div class="divider text-xs">填写内容</div>

      <div class="form-control">
        <label class="label">
          <span class="label-text font-semibold">要填写的值 *</span>
        </label>
        <input
          v-model="newTemplate.fillValue"
          type="text"
          placeholder="要自动填入输入框的内容"
          class="input input-bordered input-sm w-full"
        />
      </div>

      <div class="form-control">
        <label class="label cursor-pointer justify-start gap-2">
          <input
            v-model="newTemplate.enabled"
            type="checkbox"
            class="checkbox checkbox-primary checkbox-sm"
          />
          <span class="label-text">启用此模板</span>
        </label>
      </div>

      <button class="btn btn-primary btn-sm btn-block" @click="handleAddTemplate">
        ✅ 保存模板
      </button>
    </div>

    <!-- Settings Tab -->
    <div v-if="activeTab === 'settings'" class="p-3 space-y-4 max-h-[400px] overflow-y-auto">
      <div class="card bg-base-200">
        <div class="card-body p-3">
          <h3 class="card-title text-sm">通用匹配引擎</h3>
          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-2">
              <input
                v-model="settings.genericEngines.placeholder"
                type="checkbox"
                class="checkbox checkbox-primary checkbox-sm"
                @change="handleSettingsChange"
              />
              <span class="label-text">使用输入框 placeholder 作为填写值</span>
            </label>
          </div>
          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-2">
              <input
                v-model="settings.genericEngines.label"
                type="checkbox"
                class="checkbox checkbox-primary checkbox-sm"
                @change="handleSettingsChange"
              />
              <span class="label-text">从标签文本中提取</span>
            </label>
          </div>
          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-2">
              <input
                v-model="settings.genericEngines.quotedText"
                type="checkbox"
                class="checkbox checkbox-primary checkbox-sm"
                @change="handleSettingsChange"
              />
              <span class="label-text">从对话框引号内容提取</span>
            </label>
          </div>
          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-2">
              <input
                v-model="settings.genericEngines.dialogPattern"
                type="checkbox"
                class="checkbox checkbox-primary checkbox-sm"
                @change="handleSettingsChange"
              />
              <span class="label-text">从“请输入/请填写”文本提取</span>
            </label>
          </div>
        </div>
      </div>

      <div class="card bg-base-200">
        <div class="card-body p-3">
          <h3 class="card-title text-sm">更新</h3>
          <div class="form-control">
            <label class="label">
              <span class="label-text text-xs">更新地址（仓库 Releases）</span>
            </label>
            <input
              v-model="settings.update.releasesUrl"
              type="url"
              placeholder="https://github.com/yourname/yourrepo/releases"
              class="input input-bordered input-xs w-full"
              @change="handleSettingsChange"
            />
          </div>
          <div class="mt-2 flex gap-2">
            <button class="btn btn-primary btn-sm" @click="openReleases">
              🔄 检查更新
            </button>
            <button class="btn btn-outline btn-sm" @click="openExtensionsPage">
              🧩 打开扩展管理
            </button>
          </div>
          <p class="text-xs text-gray-500 mt-2">
            更新需手动下载并在扩展管理页重新加载。
          </p>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <dialog :class="{ 'modal modal-open': showEditModal }">
      <div class="modal-box" v-if="editingTemplate">
        <h3 class="font-bold text-lg">编辑模板</h3>
        
        <div class="form-control mt-4">
          <label class="label">
            <span class="label-text">模板名称</span>
          </label>
          <input
            v-model="editingTemplate.name"
            type="text"
            class="input input-bordered input-sm w-full"
          />
        </div>

        <div class="form-control mt-2">
          <label class="label">
            <span class="label-text">描述</span>
          </label>
          <input
            v-model="editingTemplate.description"
            type="text"
            class="input input-bordered input-sm w-full"
          />
        </div>

        <div class="form-control mt-2">
          <label class="label">
            <span class="label-text">填写值</span>
          </label>
          <input
            v-model="editingTemplate.fillValue"
            type="text"
            class="input input-bordered input-sm w-full"
          />
        </div>

        <div class="form-control mt-2">
          <label class="label cursor-pointer justify-start gap-2">
            <input
              v-model="editingTemplate.enabled"
              type="checkbox"
              class="checkbox checkbox-primary checkbox-sm"
            />
            <span class="label-text">启用</span>
          </label>
        </div>

        <div class="modal-action">
          <button class="btn btn-sm" @click="showEditModal = false">取消</button>
          <button class="btn btn-primary btn-sm" @click="handleSaveEdit">保存</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showEditModal = false">close</button>
      </form>
    </dialog>

    <!-- Footer -->
    <div class="p-2 text-center text-xs text-gray-400 border-t">
      Auto Confirm Input Helper v{{ version }}
    </div>
  </div>
</template>

<style scoped>
</style>
