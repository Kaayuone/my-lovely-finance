<script setup lang="ts">
import DatePicker from 'primevue/datepicker';
import FloatLabel from 'primevue/floatlabel';
import { TriangleAlert } from '@lucide/vue';
import FieldError from './FieldError.vue';
import InputTime from './InputTime.vue';
import { computed, ref, watch } from 'vue';

type TimeOfDay = { hours: number; minutes: number; seconds: number };

const {
  id,
  error,
  warning,
  required = false,
} = defineProps<{
  id: string;
  error?: string;
  /** A muted note under the field that does not mark it invalid; an error takes its place. */
  warning?: string;
  required?: boolean;
}>();

const model = defineModel<Date | null>();

// Time of the value whose date was just erased: the next picked day takes it instead of midnight.
// A required field keeps showing it while the date is empty. An optional one shows an empty time:
// its empty date saves as "now" or an open period, not as this time
const erasedTime = ref<TimeOfDay | null>(null);

const datePart = computed({
  get: () => validDate.value,
  set: value => {
    if (!value) {
      if (validDate.value) erasedTime.value = getTimeOfDay(validDate.value);
      model.value = null;
      return;
    }
    // The calendar returns a day at midnight, so carry over the current time
    const next = new Date(value);
    const carried = validDate.value ? getTimeOfDay(validDate.value) : erasedTime.value;
    if (carried) next.setHours(carried.hours, carried.minutes, carried.seconds, 0);
    model.value = next;
  },
});

const timePart = computed({
  get: () => {
    if (!validDate.value && !required) return null;
    const time = validDate.value ? getTimeOfDay(validDate.value) : erasedTime.value;
    return time ? { hours: time.hours, minutes: time.minutes } : null;
  },
  set: value => {
    if (!value) return;

    // Without a date the picked time lands on today; seconds of the previous value are dropped
    const next = validDate.value ? new Date(validDate.value) : new Date();
    next.setHours(value.hours, value.minutes, 0, 0);
    model.value = next;
  },
});

// A record stored with an empty date opens as an Invalid Date: there is no day to show and no time
// of day to carry over, so the field treats it as empty and a picked day can replace it
const validDate = computed(() =>
  model.value && !Number.isNaN(model.value.getTime()) ? model.value : null,
);
const label = computed(() => `Дата${required ? '*' : ''}`);

// Any date in the model, picked here or given from outside, makes the erased time obsolete
watch(validDate, value => {
  if (value) erasedTime.value = null;
});

function getTimeOfDay(date: Date): TimeOfDay {
  return { hours: date.getHours(), minutes: date.getMinutes(), seconds: date.getSeconds() };
}
</script>

<template>
  <div class="w-full">
    <div class="flex w-full gap-2">
      <FloatLabel class="min-w-0 grow" variant="on">
        <DatePicker :id v-model="datePart" :invalid="Boolean(error)" date-format="d M yy" fluid />
        <label :for="id">{{ label }}</label>
      </FloatLabel>

      <InputTime
        :id="`${id}_time`"
        v-model="timePart"
        class="w360:w-24 w-20 shrink-0"
        label="Время"
      />
    </div>

    <FieldError :message="error" class="mt-1 block" />

    <small v-if="warning && !error" class="text-muted-color mt-1 flex items-start gap-1 text-xs">
      <TriangleAlert class="mt-0.5 size-3 shrink-0" aria-hidden="true" />
      <span class="min-w-0">{{ warning }}</span>
    </small>
  </div>
</template>
