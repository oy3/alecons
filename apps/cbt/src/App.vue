<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
/* Global styles for CBT portal */
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #f8f9fa;
}

/* Full-screen exam mode */
.exam-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: white;
  z-index: 9999;
  overflow: hidden;
}

/* Security warnings */
.security-warning {
  background: #ff6b6b;
  color: white;
  padding: 10px;
  text-align: center;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10000;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}

/* Timer styles */
.exam-timer {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #007bff;
  color: white;
  padding: 10px 20px;
  border-radius: 25px;
  font-weight: bold;
  z-index: 1000;
}

.exam-timer.warning {
  background: #ffc107;
  color: #212529;
}

.exam-timer.danger {
  background: #dc3545;
  animation: pulse 1s infinite;
}

/* Question navigation */
.question-nav {
  max-height: 400px;
  overflow-y: auto;
}

.question-nav-item {
  min-width: 40px;
  height: 40px;
  margin: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
}

.question-nav-item.answered {
  background: #28a745;
  color: white;
}

.question-nav-item.current {
  background: #007bff;
  color: white;
  transform: scale(1.1);
}

.question-nav-item.unanswered {
  background: #6c757d;
  color: white;
}

/* Exam interface */
.exam-interface {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.exam-header {
  background: #343a40;
  color: white;
  padding: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.exam-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.question-panel {
  flex: 1;
  padding: 30px;
  overflow-y: auto;
}

.navigation-panel {
  width: 300px;
  background: #f8f9fa;
  border-left: 1px solid #dee2e6;
  padding: 20px;
}

.exam-footer {
  background: #f8f9fa;
  padding: 20px;
  border-top: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Auto-save indicator */
.autosave-indicator {
  position: fixed;
  top: 70px;
  right: 20px;
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.8rem;
  z-index: 1000;
}

.autosave-indicator.saving {
  background: #ffc107;
  color: #212529;
}

.autosave-indicator.saved {
  background: #28a745;
  color: white;
}

.autosave-indicator.error {
  background: #dc3545;
  color: white;
}
</style>