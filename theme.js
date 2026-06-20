(function () {
  const SYSTEM_MEDIA = window.matchMedia('(prefers-color-scheme: dark)')

  const MOON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>'

  const SUN_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>'

  let overrideTheme = null

  function getSystemTheme() {
    return SYSTEM_MEDIA.matches ? 'dark' : 'light'
  }

  let lastSystemTheme = getSystemTheme()

  function getActiveTheme() {
    return overrideTheme ?? getSystemTheme()
  }

  function getTheme() {
    const current = document.documentElement.dataset.theme
    if (current === 'light' || current === 'dark') return current
    return getActiveTheme()
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    updateHljs(theme)
  }

  function updateHljs(theme) {
    const hljsLight = document.getElementById('hljs-light')
    const hljsDark = document.getElementById('hljs-dark')
    if (hljsLight && hljsDark) {
      hljsLight.disabled = theme !== 'light'
      hljsDark.disabled = theme !== 'dark'
    }
  }

  function updateToggleButton() {
    const btn = document.getElementById('theme-toggle')
    if (!btn) return
    const isDark = getTheme() === 'dark'
    btn.innerHTML = isDark ? SUN_SVG : MOON_SVG
    const label = isDark ? 'Switch to light mode' : 'Switch to dark mode'
    btn.setAttribute('aria-label', label)
    btn.title = label
  }

  function ensureSystemTheme() {
    const system = getSystemTheme()

    if (overrideTheme) {
      if (system === lastSystemTheme) return
      lastSystemTheme = system
      overrideTheme = null
      applyTheme(system)
      updateToggleButton()
      return
    }

    if (system === lastSystemTheme && getTheme() === system) return

    lastSystemTheme = system
    applyTheme(system)
    updateToggleButton()
  }

  function toggleTheme() {
    const next = getTheme() === 'dark' ? 'light' : 'dark'
    overrideTheme = next
    applyTheme(next)
    updateToggleButton()
  }

  function mountToggle() {
    if (document.getElementById('theme-toggle')) {
      updateToggleButton()
      return
    }
    const resume = document.querySelector('.page-header .nav-resume')
    if (!resume) return
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'nav-theme'
    btn.id = 'theme-toggle'
    btn.addEventListener('click', toggleTheme)
    resume.insertAdjacentElement('afterend', btn)
    updateToggleButton()
  }

  function watchSystemTheme() {
    if (SYSTEM_MEDIA.addEventListener) {
      SYSTEM_MEDIA.addEventListener('change', ensureSystemTheme)
    } else if (SYSTEM_MEDIA.addListener) {
      SYSTEM_MEDIA.addListener(ensureSystemTheme)
    }
  }

  applyTheme(getActiveTheme())
  watchSystemTheme()

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') ensureSystemTheme()
  })

  window.addEventListener('pageshow', ensureSystemTheme)
  window.addEventListener('focus', ensureSystemTheme)

  // macOS/Safari often skip matchMedia "change" while the tab stays focused
  setInterval(() => {
    if (document.visibilityState !== 'hidden') ensureSystemTheme()
  }, 1000)

  function onReady() {
    updateHljs(getTheme())
    mountToggle()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady)
  } else {
    onReady()
  }
})()
