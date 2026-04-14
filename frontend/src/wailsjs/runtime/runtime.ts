export function EventsOn(eventName: string, callback: (...data: any[]) => void): () => void {
  // @ts-ignore
  const off = window.runtime?.EventsOn(eventName, callback)
  return off ?? (() => {})
}

export function EventsOff(eventName: string, ...additionalEventNames: string[]): void {
  // @ts-ignore
  window.runtime?.EventsOff(eventName, ...additionalEventNames)
}

export function WindowMinimise(): void {
  // @ts-ignore
  window.runtime?.WindowMinimise()
}

export function WindowMaximise(): void {
  // @ts-ignore
  window.runtime?.WindowMaximise()
}

export function WindowClose(): void {
  // @ts-ignore
  window.runtime?.WindowClose()
}

export function WindowToggleMaximise(): void {
  // @ts-ignore
  window.runtime?.WindowToggleMaximise()
}
