<script setup>
defineProps({
  visible: Boolean,
  noPad: Boolean,
});
const emit = defineEmits(["update:visible"]);
</script>

<template>
  <Transition name="modal-fade">
    <div
      class="modal-outer transition-box"
      v-show="visible"
      @click="emit('update:visible', !visible)"
    >
      <div class="modal-mid">
        <div class="modal-before"></div>
        <div
          :class="{ 'modal-inner': true, 'no-pad': noPad }"
          @click="(e) => e.stopPropagation()"
        >
          <slot />
        </div>
        <div class="modal-after"></div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-outer {
  display: flex;
  background: rgba(150, 150, 150, 0.5);
  position: absolute;
  left: 0;
  width: 100vw;
  height: calc(100vh);
  justify-content: center;
  align-items: left;
  overflow-y: scroll;
  overflow-x: hidden;
  padding: 0px 50px;
}

.modal-mid {
  max-height: calc(100vh);
}

.modal-before,
.modal-after {
  min-height: 25px;
}

.modal-inner {
  padding: 10px 20px;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  box-shadow: 0 1.5px 9px rgba(0, 0, 0, 0.3);
  overflow: clip;
}
.modal-inner.no-pad {
  padding: 0;
}

/* Panel transitions */
.modal-fade-enter-active {
  transition: all 0.1s ease-out;
}
.modal-fade-leave-active {
  transition: all 0.1s ease-out;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: scale(1) translateY(-10px);
}
</style>
