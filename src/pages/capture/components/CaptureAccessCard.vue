<script setup lang="ts">
import { CircleAlert, CircleCheck } from '@lucide/vue';
import Button from 'primevue/button';
import {
  openAppDetails,
  openCaptureAccessSettings,
  requestListenerRebind,
} from '@/services/capture';
import { computed, ref } from 'vue';
import type { CaptureStatus } from '@/services/capture';
import { APP_TITLE } from '@/constants/app';

// Android 13: an APK installed from a file gets notification access only after the person allows
// «restricted settings» on its «App info» page
const RESTRICTED_SETTINGS_SDK = 33;

const { status } = defineProps<{ status: CaptureStatus }>();
const emit = defineEmits<{ changed: [] }>();

const settingsFailed = ref(false);

const showRestrictedHint = computed(() => status.sdkInt >= RESTRICTED_SETTINGS_SDK);

async function onOpenAccessSettings() {
  try {
    settingsFailed.value = !(await openCaptureAccessSettings());
  } catch (error) {
    settingsFailed.value = true;
    console.error('Failed to open the notification access settings', error);
  }
}

async function onOpenAppDetails() {
  try {
    settingsFailed.value = !(await openAppDetails());
  } catch (error) {
    settingsFailed.value = true;
    console.error('Failed to open the app details', error);
  }
}

async function onRebind() {
  try {
    await requestListenerRebind();
  } catch (error) {
    console.error('Failed to request a rebind of the notification listener', error);
  }
  emit('changed');
}
</script>

<template>
  <section class="bg-card flex flex-col gap-3 rounded-xl p-4">
    <template v-if="!status.accessGranted">
      <h2 class="text-color font-semibold">Нужен доступ к уведомлениям</h2>
      <p class="text-muted-color text-sm">
        Чтобы траты по карте записывались сами, приложение читает уведомления — но только тех
        приложений, которые вы выберете ниже: банков и SMS. Текст уведомлений хранится на этом
        телефоне и никуда не отправляется.
      </p>
      <Button label="Разрешить доступ" @click="onOpenAccessSettings" />
      <template v-if="showRestrictedHint">
        <p class="text-muted-color text-sm">
          Переключатель неактивен? Так Android защищает приложения, установленные из файла: откройте
          «О приложении», нажмите ⋮ → «Разрешить ограниченные настройки» и включите доступ снова.
        </p>
        <Button label="О приложении" severity="secondary" outlined @click="onOpenAppDetails" />
      </template>
    </template>

    <template v-else>
      <div class="flex items-center gap-2">
        <CircleCheck
          v-if="status.listenerConnected"
          class="text-primary size-5 shrink-0"
          aria-hidden="true"
        />
        <CircleAlert v-else class="text-invalid size-5 shrink-0" aria-hidden="true" />
        <h2 class="text-color font-semibold">Доступ включён</h2>
      </div>
      <p v-if="status.listenerConnected" class="text-muted-color text-sm">
        Служба на связи: уведомления выбранных приложений записываются.
      </p>
      <template v-else>
        <p class="text-invalid text-sm">Служба не на связи — уведомления сейчас не записываются.</p>
        <Button label="Перезапустить службу" @click="onRebind" />
      </template>
      <Button
        label="Настройки доступа"
        severity="secondary"
        outlined
        @click="onOpenAccessSettings"
      />
    </template>

    <p v-if="settingsFailed" class="text-invalid text-sm">
      Настройки не открылись. Найдите в настройках телефона «Доступ к уведомлениям» и включите его
      для {{ APP_TITLE }}.
    </p>
  </section>
</template>
