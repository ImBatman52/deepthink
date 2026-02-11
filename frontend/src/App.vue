<template>
  <div class="app-bg-layer" :class="{ active: bgEnabled }" :style="bgStyle"></div>
  <RouterView />
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router';
import { computed } from 'vue';
import { useThemeStore } from './stores/themeStore';

const themeStore = useThemeStore();

const bgEnabled = computed(() => themeStore.background.enabled && themeStore.background.imageUrl);

const bgStyle = computed(() => {
  if (!bgEnabled.value) return {};
  return {
    backgroundImage: `url(${themeStore.background.imageUrl})`,
    opacity: themeStore.background.opacity / 100,
    filter: `blur(${themeStore.background.blur}px) brightness(${themeStore.background.brightness / 100})`,
  };
});
</script>

<style>
#app {
  width: 100%;
  height: var(--app-height);
  min-height: -webkit-fill-available;
  overflow: hidden;
  background: var(--bg-primary);
  position: relative;
}

.app-bg-layer {
  position: fixed;
  inset: 0;
  z-index: -1;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease, filter 0.3s ease;
}

.app-bg-layer.active {
  opacity: 1;
}
</style>
