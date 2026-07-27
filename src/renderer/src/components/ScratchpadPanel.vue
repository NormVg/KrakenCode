<script setup lang="ts">
import { ref } from 'vue'

const content = ref('')
</script>

<template>
  <div class="scratchpad-panel">
    <div class="panel-header">
      <h3>Scratchpad</h3>
    </div>
    
    <div class="scratchpad-content">
      <textarea 
        v-model="content" 
        placeholder="Dump your thoughts, notes, and scratchpad context here..."
        class="scratchpad-textarea"
      ></textarea>
    </div>
  </div>
</template>

<style scoped>
.scratchpad-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px 16px 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-header h3 {
  font-size: 0.85em;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.scratchpad-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-bottom: 16px;
}

.scratchpad-textarea {
  flex: 1;
  background: rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  color: var(--text-main);
  padding: 12px;
  font-size: 0.9em;
  font-family: inherit;
  resize: none;
  outline: none;
  transition: border-color 0.2s ease;
}

.scratchpad-textarea:focus {
  border-color: rgba(255, 255, 255, 0.15);
}
</style>
