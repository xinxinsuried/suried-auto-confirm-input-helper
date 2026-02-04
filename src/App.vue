<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
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
const contentStatus = ref<'unknown' | 'ok' | 'missing'>('unknown')

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
  checkContentStatus()
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

async function checkContentStatus() {
  contentStatus.value = 'unknown'
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    contentStatus.value = 'missing'
    return
  }

  let responded = false
  const timeout = setTimeout(() => {
    if (!responded) contentStatus.value = 'missing'
  }, 800)

  try {
    chrome.tabs.sendMessage(tab.id, { action: 'ping' }, (response) => {
      responded = true
      clearTimeout(timeout)
      contentStatus.value = response?.ok ? 'ok' : 'missing'
    })
  } catch {
    clearTimeout(timeout)
    contentStatus.value = 'missing'
  }
}

const statusIcon = computed(() => {
  if (contentStatus.value === 'ok') return '●'
  if (contentStatus.value === 'missing') return '○'
  return '◐'
})

const statusClass = computed(() => {
  if (contentStatus.value === 'ok') return 'status-online'
  if (contentStatus.value === 'missing') return 'status-offline'
  return 'status-checking'
})
</script>

<template>
  <div class="cyber-container">
    <!-- Scanline effect -->
    <div class="scanline"></div>
    
    <!-- Header -->
    <header class="cyber-header">
      <div class="header-left">
        <div class="logo-icon">
          <span class="icon-glow">⚡</span>
        </div>
        <div class="header-text">
          <h1 class="app-title">AUTO_FILL</h1>
          <span class="app-subtitle">// 确认输入助手</span>
        </div>
      </div>
      <div class="header-right">
        <span :class="['status-dot', statusClass]">{{ statusIcon }}</span>
        <button class="trigger-btn" @click="triggerFill" title="立即触发">
          <span class="btn-icon">▶</span>
          <span class="btn-text">RUN</span>
        </button>
      </div>
    </header>

    <!-- Navigation -->
    <nav class="cyber-nav">
      <button 
        :class="['nav-item', { active: activeTab === 'list' }]"
        @click="activeTab = 'list'"
      >
        <span class="nav-icon">[</span>
        <span class="nav-label">模板</span>
        <span class="nav-icon">]</span>
        <span class="nav-count" v-if="templates.length">{{ templates.length }}</span>
      </button>
      <button 
        :class="['nav-item', { active: activeTab === 'add' }]"
        @click="activeTab = 'add'"
      >
        <span class="nav-icon">[</span>
        <span class="nav-label">新增</span>
        <span class="nav-icon">]</span>
      </button>
      <button 
        :class="['nav-item', { active: activeTab === 'settings' }]"
        @click="activeTab = 'settings'"
      >
        <span class="nav-icon">[</span>
        <span class="nav-label">设置</span>
        <span class="nav-icon">]</span>
      </button>
    </nav>

    <!-- Content Area -->
    <main class="cyber-content">
      <!-- List Tab -->
      <div v-if="activeTab === 'list'" class="tab-content">
        <div v-if="templates.length === 0" class="empty-state">
          <div class="empty-icon">∅</div>
          <p class="empty-text">// 暂无模板数据</p>
          <button class="cyber-btn secondary" @click="activeTab = 'add'">
            <span>+ 创建模板</span>
          </button>
        </div>

        <div class="template-list">
          <div 
            v-for="(template, index) in templates" 
            :key="template.id"
            :class="['template-card', { disabled: !template.enabled }]"
            :style="{ '--delay': index * 0.05 + 's' }"
          >
            <div class="card-header">
              <div class="card-status">
                <button 
                  :class="['toggle-btn', { active: template.enabled }]"
                  @click="handleToggle(template.id)"
                >
                  <span class="toggle-track">
                    <span class="toggle-thumb"></span>
                  </span>
                </button>
              </div>
              <div class="card-title">
                <span class="title-prefix">&gt;</span>
                <span class="title-text">{{ template.name }}</span>
              </div>
              <div class="card-actions">
                <button class="action-btn edit" @click="startEdit(template)" title="编辑">
                  <span>✎</span>
                </button>
                <button class="action-btn delete" @click="handleDelete(template.id)" title="删除">
                  <span>×</span>
                </button>
              </div>
            </div>
            <div class="card-body">
              <p class="card-desc" v-if="template.description">{{ template.description }}</p>
              <div class="card-value">
                <span class="value-label">OUTPUT:</span>
                <code class="value-code">{{ template.fillValue }}</code>
              </div>
            </div>
          </div>
        </div>

        <div class="list-footer" v-if="templates.length > 0">
          <button class="cyber-btn danger" @click="handleReset">
            <span class="btn-icon">↺</span>
            <span>重置默认</span>
          </button>
        </div>
      </div>

      <!-- Add Tab -->
      <div v-if="activeTab === 'add'" class="tab-content">
        <div class="form-section">
          <div class="section-header">
            <span class="section-icon">▸</span>
            <span class="section-title">基本信息</span>
          </div>
          
          <div class="cyber-field">
            <label class="field-label">
              <span class="label-text">NAME</span>
              <span class="label-required">*</span>
            </label>
            <input 
              v-model="newTemplate.name"
              type="text" 
              class="cyber-input"
              placeholder="输入模板名称..."
            />
          </div>

          <div class="cyber-field">
            <label class="field-label">
              <span class="label-text">DESC</span>
            </label>
            <input 
              v-model="newTemplate.description"
              type="text" 
              class="cyber-input"
              placeholder="模板用途说明..."
            />
          </div>
        </div>

        <div class="form-section">
          <div class="section-header">
            <span class="section-icon">▸</span>
            <span class="section-title">匹配规则</span>
            <span class="section-hint">// 至少填写一项</span>
          </div>

          <div class="cyber-field">
            <label class="field-label">
              <span class="label-text">URL_PATTERN</span>
            </label>
            <input 
              v-model="newTemplate.matcher.urlPattern"
              type="text" 
              class="cyber-input mono"
              placeholder="*cloud.tencent.com*"
            />
          </div>

          <div class="cyber-field">
            <label class="field-label">
              <span class="label-text">CONTAINS_TEXT</span>
            </label>
            <textarea 
              v-model="newTemplate.matcher.containsText"
              class="cyber-textarea mono"
              placeholder="每行一个关键词&#10;确认删除&#10;无法恢复"
              rows="3"
            ></textarea>
          </div>

          <div class="cyber-field">
            <label class="field-label">
              <span class="label-text">PLACEHOLDER</span>
            </label>
            <input 
              v-model="newTemplate.matcher.placeholderPattern"
              type="text" 
              class="cyber-input mono"
              placeholder="输入框placeholder内容"
            />
          </div>

          <div class="field-row">
            <div class="cyber-field">
              <label class="field-label">
                <span class="label-text">INPUT_CLASS</span>
              </label>
              <input 
                v-model="newTemplate.matcher.inputClassPattern"
                type="text" 
                class="cyber-input mono"
                placeholder="css-class"
              />
            </div>
            <div class="cyber-field">
              <label class="field-label">
                <span class="label-text">CONTAINER</span>
              </label>
              <input 
                v-model="newTemplate.matcher.containerClassPattern"
                type="text" 
                class="cyber-input mono"
                placeholder="parent-class"
              />
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="section-header">
            <span class="section-icon">▸</span>
            <span class="section-title">输出配置</span>
          </div>

          <div class="cyber-field">
            <label class="field-label">
              <span class="label-text">FILL_VALUE</span>
              <span class="label-required">*</span>
            </label>
            <input 
              v-model="newTemplate.fillValue"
              type="text" 
              class="cyber-input highlight"
              placeholder="自动填入的内容"
            />
          </div>

          <div class="cyber-checkbox">
            <label class="checkbox-wrapper">
              <input type="checkbox" v-model="newTemplate.enabled" />
              <span class="checkbox-custom"></span>
              <span class="checkbox-label">启用模板</span>
            </label>
          </div>
        </div>

        <div class="form-actions">
          <button class="cyber-btn secondary" @click="resetNewTemplate">
            <span>清空</span>
          </button>
          <button class="cyber-btn primary" @click="handleAddTemplate">
            <span class="btn-icon">+</span>
            <span>保存模板</span>
          </button>
        </div>
      </div>

      <!-- Settings Tab -->
      <div v-if="activeTab === 'settings'" class="tab-content">
        <div class="settings-section">
          <div class="section-header">
            <span class="section-icon">◈</span>
            <span class="section-title">通用匹配引擎</span>
          </div>
          
          <div class="settings-grid">
            <div class="cyber-checkbox">
              <label class="checkbox-wrapper">
                <input 
                  type="checkbox" 
                  v-model="settings.genericEngines.placeholder"
                  @change="handleSettingsChange"
                />
                <span class="checkbox-custom"></span>
                <span class="checkbox-label">从 placeholder 提取</span>
              </label>
            </div>

            <div class="cyber-checkbox">
              <label class="checkbox-wrapper">
                <input 
                  type="checkbox" 
                  v-model="settings.genericEngines.label"
                  @change="handleSettingsChange"
                />
                <span class="checkbox-custom"></span>
                <span class="checkbox-label">从 label 标签提取</span>
              </label>
            </div>

            <div class="cyber-checkbox">
              <label class="checkbox-wrapper">
                <input 
                  type="checkbox" 
                  v-model="settings.genericEngines.quotedText"
                  @change="handleSettingsChange"
                />
                <span class="checkbox-custom"></span>
                <span class="checkbox-label">从引号内容提取</span>
              </label>
            </div>

            <div class="cyber-checkbox">
              <label class="checkbox-wrapper">
                <input 
                  type="checkbox" 
                  v-model="settings.genericEngines.dialogPattern"
                  @change="handleSettingsChange"
                />
                <span class="checkbox-custom"></span>
                <span class="checkbox-label">从"请输入/请填写"提取</span>
              </label>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="section-header">
            <span class="section-icon">◈</span>
            <span class="section-title">更新配置</span>
          </div>

          <div class="cyber-field">
            <label class="field-label">
              <span class="label-text">RELEASES_URL</span>
            </label>
            <input 
              v-model="settings.update.releasesUrl"
              type="url" 
              class="cyber-input mono"
              placeholder="https://github.com/user/repo/releases"
              @change="handleSettingsChange"
            />
          </div>

          <div class="button-row">
            <button class="cyber-btn primary" @click="openReleases">
              <span class="btn-icon">↓</span>
              <span>检查更新</span>
            </button>
            <button class="cyber-btn secondary" @click="openExtensionsPage">
              <span class="btn-icon">⚙</span>
              <span>扩展管理</span>
            </button>
          </div>
        </div>

        <div class="settings-section">
          <div class="section-header">
            <span class="section-icon">◈</span>
            <span class="section-title">运行状态</span>
          </div>

          <div class="status-display">
            <div class="status-item">
              <span class="status-label">CONTENT_SCRIPT</span>
              <span :class="['status-value', statusClass]">
                {{ contentStatus === 'ok' ? 'ACTIVE' : contentStatus === 'missing' ? 'INACTIVE' : 'CHECKING...' }}
              </span>
            </div>
          </div>

          <button class="cyber-btn secondary" @click="checkContentStatus">
            <span class="btn-icon">⟳</span>
            <span>重新检测</span>
          </button>

          <p class="settings-hint">
            // 若未注入，请确保加载 dist 目录并刷新页面
          </p>
        </div>
      </div>
    </main>

    <!-- Edit Modal -->
    <Teleport to="body">
      <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
        <div class="cyber-modal">
          <div class="modal-header">
            <h3 class="modal-title">
              <span class="title-icon">✎</span>
              <span>编辑模板</span>
            </h3>
            <button class="modal-close" @click="showEditModal = false">×</button>
          </div>

          <div class="modal-body" v-if="editingTemplate">
            <div class="cyber-field">
              <label class="field-label">
                <span class="label-text">NAME</span>
              </label>
              <input 
                v-model="editingTemplate.name"
                type="text" 
                class="cyber-input"
              />
            </div>

            <div class="cyber-field">
              <label class="field-label">
                <span class="label-text">DESC</span>
              </label>
              <input 
                v-model="editingTemplate.description"
                type="text" 
                class="cyber-input"
              />
            </div>

            <div class="cyber-field">
              <label class="field-label">
                <span class="label-text">FILL_VALUE</span>
              </label>
              <input 
                v-model="editingTemplate.fillValue"
                type="text" 
                class="cyber-input highlight"
              />
            </div>

            <div class="cyber-checkbox">
              <label class="checkbox-wrapper">
                <input type="checkbox" v-model="editingTemplate.enabled" />
                <span class="checkbox-custom"></span>
                <span class="checkbox-label">启用模板</span>
              </label>
            </div>
          </div>

          <div class="modal-footer">
            <button class="cyber-btn secondary" @click="showEditModal = false">
              <span>取消</span>
            </button>
            <button class="cyber-btn primary" @click="handleSaveEdit">
              <span class="btn-icon">✓</span>
              <span>保存</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Footer -->
    <footer class="cyber-footer">
      <span class="footer-text">AUTO_FILL v{{ version }}</span>
      <span class="footer-divider">|</span>
      <span class="footer-status">SYS_READY</span>
    </footer>
  </div>
</template>

<style>
/* Import fonts */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Orbitron:wght@400;500;600;700;800;900&display=swap');

:root {
  /* Neon Colors */
  --neon-cyan: #00fff9;
  --neon-pink: #ff00ff;
  --neon-green: #39ff14;
  --neon-yellow: #ffff00;
  --neon-orange: #ff6600;
  --neon-red: #ff0040;
  
  /* Background */
  --bg-deep: #0a0a0f;
  --bg-dark: #0d1117;
  --bg-medium: #161b22;
  --bg-light: #21262d;
  --bg-hover: #30363d;
  
  /* Text */
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-muted: #484f58;
  
  /* Glow effects */
  --glow-cyan: 0 0 10px var(--neon-cyan), 0 0 20px var(--neon-cyan), 0 0 40px var(--neon-cyan);
  --glow-pink: 0 0 10px var(--neon-pink), 0 0 20px var(--neon-pink), 0 0 40px var(--neon-pink);
  --glow-green: 0 0 10px var(--neon-green), 0 0 20px var(--neon-green);
  
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  
  /* Border */
  --border-color: rgba(0, 255, 249, 0.2);
  --border-hover: rgba(0, 255, 249, 0.5);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg-deep);
}
</style>

<style scoped>
.cyber-container {
  width: 460px;
  min-height: 520px;
  max-height: 600px;
  background: var(--bg-dark);
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  color: var(--text-primary);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Scanline animation */
.scanline {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(0, 255, 249, 0.1),
    transparent
  );
  animation: scanline 4s linear infinite;
  pointer-events: none;
  z-index: 100;
}

@keyframes scanline {
  0% { top: -10%; }
  100% { top: 110%; }
}

/* Header */
.cyber-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md) var(--space-lg);
  background: linear-gradient(180deg, var(--bg-medium) 0%, var(--bg-dark) 100%);
  border-bottom: 1px solid var(--border-color);
  position: relative;
}

.cyber-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--neon-cyan), transparent);
  opacity: 0.5;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.logo-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-deep);
  border: 1px solid var(--neon-cyan);
  border-radius: 4px;
  position: relative;
}

.icon-glow {
  font-size: 18px;
  text-shadow: var(--glow-cyan);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.header-text {
  display: flex;
  flex-direction: column;
}

.app-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--neon-cyan);
  text-shadow: var(--glow-cyan);
  line-height: 1.2;
}

.app-subtitle {
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 1px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.status-dot {
  font-size: 12px;
  transition: all 0.3s ease;
}

.status-online {
  color: var(--neon-green);
  text-shadow: var(--glow-green);
}

.status-offline {
  color: var(--neon-red);
}

.status-checking {
  color: var(--neon-yellow);
  animation: blink 1s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.trigger-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  background: transparent;
  border: 1px solid var(--neon-green);
  color: var(--neon-green);
  font-family: 'Orbitron', sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
}

.trigger-btn:hover {
  background: var(--neon-green);
  color: var(--bg-deep);
  box-shadow: var(--glow-green);
}

.trigger-btn .btn-icon {
  font-size: 10px;
}

/* Navigation */
.cyber-nav {
  display: flex;
  padding: var(--space-sm) var(--space-lg);
  gap: var(--space-sm);
  background: var(--bg-deep);
  border-bottom: 1px solid var(--border-color);
}

.nav-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: var(--space-sm) var(--space-md);
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.nav-item:hover {
  color: var(--text-primary);
  border-color: var(--border-color);
}

.nav-item.active {
  color: var(--neon-cyan);
  border-color: var(--neon-cyan);
  background: rgba(0, 255, 249, 0.05);
}

.nav-item.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--neon-cyan);
  box-shadow: 0 0 10px var(--neon-cyan);
}

.nav-icon {
  opacity: 0.5;
  font-size: 10px;
}

.nav-count {
  margin-left: var(--space-xs);
  padding: 1px 5px;
  background: var(--neon-cyan);
  color: var(--bg-deep);
  font-size: 9px;
  font-weight: 700;
  border-radius: 2px;
}

/* Content */
.cyber-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.cyber-content::-webkit-scrollbar {
  width: 6px;
}

.cyber-content::-webkit-scrollbar-track {
  background: var(--bg-deep);
}

.cyber-content::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.cyber-content::-webkit-scrollbar-thumb:hover {
  background: var(--neon-cyan);
}

.tab-content {
  padding: var(--space-lg);
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  color: var(--text-muted);
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  color: var(--text-secondary);
  font-size: 12px;
  margin-bottom: 16px;
}

/* Template List */
.template-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.template-card {
  background: var(--bg-medium);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
  transition: all 0.2s ease;
  animation: slideIn 0.3s ease;
  animation-delay: var(--delay);
  animation-fill-mode: backwards;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

.template-card:hover {
  border-color: var(--border-hover);
  box-shadow: 0 0 20px rgba(0, 255, 249, 0.1);
}

.template-card.disabled {
  opacity: 0.5;
}

.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-light);
  border-bottom: 1px solid var(--border-color);
}

.card-status {
  flex-shrink: 0;
}

.toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.toggle-track {
  display: block;
  width: 32px;
  height: 16px;
  background: var(--bg-deep);
  border: 1px solid var(--text-muted);
  border-radius: 8px;
  position: relative;
  transition: all 0.2s ease;
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  background: var(--text-muted);
  border-radius: 50%;
  transition: all 0.2s ease;
}

.toggle-btn.active .toggle-track {
  border-color: var(--neon-green);
  background: rgba(57, 255, 20, 0.1);
}

.toggle-btn.active .toggle-thumb {
  left: 18px;
  background: var(--neon-green);
  box-shadow: 0 0 8px var(--neon-green);
}

.card-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
}

.title-prefix {
  color: var(--neon-cyan);
  font-size: 12px;
}

.title-text {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-actions {
  display: flex;
  gap: var(--space-xs);
}

.action-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 2px;
}

.action-btn:hover {
  border-color: var(--border-color);
}

.action-btn.edit:hover {
  color: var(--neon-cyan);
  border-color: var(--neon-cyan);
}

.action-btn.delete:hover {
  color: var(--neon-red);
  border-color: var(--neon-red);
}

.card-body {
  padding: var(--space-md);
}

.card-desc {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: var(--space-sm);
}

.card-value {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  background: var(--bg-deep);
  border-radius: 2px;
  border-left: 2px solid var(--neon-green);
}

.value-label {
  font-size: 9px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.value-code {
  font-size: 12px;
  color: var(--neon-green);
  font-family: 'JetBrains Mono', monospace;
}

.list-footer {
  margin-top: var(--space-lg);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--border-color);
}

/* Form Styles */
.form-section {
  margin-bottom: var(--space-xl);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-sm);
  border-bottom: 1px dashed var(--border-color);
}

.section-icon {
  color: var(--neon-cyan);
  font-size: 10px;
}

.section-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text-primary);
}

.section-hint {
  font-size: 10px;
  color: var(--text-muted);
  margin-left: auto;
}

.cyber-field {
  margin-bottom: var(--space-md);
}

.field-label {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: var(--space-xs);
}

.label-text {
  font-size: 10px;
  color: var(--text-secondary);
  letter-spacing: 1px;
  text-transform: uppercase;
}

.label-required {
  color: var(--neon-pink);
  font-size: 10px;
}

.cyber-input,
.cyber-textarea {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-deep);
  border: 1px solid var(--border-color);
  border-radius: 2px;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  transition: all 0.2s ease;
}

.cyber-input:focus,
.cyber-textarea:focus {
  outline: none;
  border-color: var(--neon-cyan);
  box-shadow: 0 0 10px rgba(0, 255, 249, 0.2);
}

.cyber-input.mono,
.cyber-textarea.mono {
  font-size: 11px;
}

.cyber-input.highlight {
  border-color: var(--neon-green);
}

.cyber-input.highlight:focus {
  border-color: var(--neon-green);
  box-shadow: 0 0 10px rgba(57, 255, 20, 0.2);
}

.cyber-input::placeholder,
.cyber-textarea::placeholder {
  color: var(--text-muted);
}

.cyber-textarea {
  resize: vertical;
  min-height: 60px;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

/* Checkbox */
.cyber-checkbox {
  margin-bottom: var(--space-md);
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
}

.checkbox-wrapper input {
  display: none;
}

.checkbox-custom {
  width: 16px;
  height: 16px;
  border: 1px solid var(--border-color);
  background: var(--bg-deep);
  position: relative;
  transition: all 0.2s ease;
}

.checkbox-wrapper input:checked + .checkbox-custom {
  border-color: var(--neon-cyan);
  background: rgba(0, 255, 249, 0.1);
}

.checkbox-custom::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0);
  color: var(--neon-cyan);
  font-size: 10px;
  transition: all 0.2s ease;
}

.checkbox-wrapper input:checked + .checkbox-custom::after {
  transform: translate(-50%, -50%) scale(1);
}

.checkbox-label {
  font-size: 12px;
  color: var(--text-secondary);
}

/* Buttons */
.cyber-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 2px;
}

.cyber-btn .btn-icon {
  font-size: 12px;
}

.cyber-btn.primary {
  background: var(--neon-cyan);
  border: 1px solid var(--neon-cyan);
  color: var(--bg-deep);
}

.cyber-btn.primary:hover {
  background: transparent;
  color: var(--neon-cyan);
  box-shadow: var(--glow-cyan);
}

.cyber-btn.secondary {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.cyber-btn.secondary:hover {
  border-color: var(--neon-cyan);
  color: var(--neon-cyan);
}

.cyber-btn.danger {
  background: transparent;
  border: 1px solid var(--neon-red);
  color: var(--neon-red);
}

.cyber-btn.danger:hover {
  background: var(--neon-red);
  color: var(--bg-deep);
  box-shadow: 0 0 20px rgba(255, 0, 64, 0.3);
}

.form-actions {
  display: flex;
  gap: var(--space-md);
  justify-content: flex-end;
  margin-top: var(--space-xl);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--border-color);
}

.button-row {
  display: flex;
  gap: var(--space-md);
  margin-top: var(--space-md);
}

/* Settings */
.settings-section {
  margin-bottom: var(--space-xl);
  padding: var(--space-lg);
  background: var(--bg-medium);
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
}

.status-display {
  margin-bottom: var(--space-md);
}

.status-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-deep);
  border-radius: 2px;
}

.status-label {
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 1px;
}

.status-value {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
}

.status-value.status-online {
  color: var(--neon-green);
}

.status-value.status-offline {
  color: var(--neon-red);
}

.status-value.status-checking {
  color: var(--neon-yellow);
}

.settings-hint {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: var(--space-md);
  font-style: italic;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.cyber-modal {
  width: 90%;
  max-width: 400px;
  background: var(--bg-dark);
  border: 1px solid var(--neon-cyan);
  border-radius: 4px;
  box-shadow: var(--glow-cyan);
  animation: modalIn 0.3s ease;
}

@keyframes modalIn {
  from { 
    opacity: 0; 
    transform: scale(0.9) translateY(-20px); 
  }
  to { 
    opacity: 1; 
    transform: scale(1) translateY(0); 
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  background: var(--bg-medium);
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-family: 'Orbitron', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: var(--neon-cyan);
}

.title-icon {
  font-size: 14px;
}

.modal-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-close:hover {
  border-color: var(--neon-red);
  color: var(--neon-red);
}

.modal-body {
  padding: var(--space-lg);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  background: var(--bg-medium);
  border-top: 1px solid var(--border-color);
}

/* Footer */
.cyber-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg);
  background: var(--bg-deep);
  border-top: 1px solid var(--border-color);
  font-size: 9px;
  color: var(--text-muted);
  letter-spacing: 1px;
}

.footer-divider {
  opacity: 0.3;
}

.footer-status {
  color: var(--neon-green);
}
</style>
