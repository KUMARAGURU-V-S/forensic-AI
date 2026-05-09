/**
 * WebSocket client for real-time case updates.
 * Connects to ws://localhost:8000/ws/{caseId} and pushes events into the Zustand store.
 */

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

let _socket = null
let _caseId = null
let _pingInterval = null
let _reconnectTimeout = null
let _storeRef = null

export function connectWS(caseId, store) {
  if (_socket && _caseId === caseId && _socket.readyState === WebSocket.OPEN) return
  _storeRef = store
  _caseId = caseId
  _doConnect(caseId)
}

function _doConnect(caseId) {
  try {
    _socket = new WebSocket(`${WS_BASE}/ws/${caseId}`)

    _socket.onopen = () => {
      console.log('[WS] Connected to case', caseId)
      _storeRef?.getState?.()?.setWsConnected?.(true)
      // Send initial subscription
      _socket.send(JSON.stringify({ type: 'subscribe', case_id: caseId }))
      // Heartbeat
      _pingInterval = setInterval(() => {
        if (_socket?.readyState === WebSocket.OPEN) {
          _socket.send(JSON.stringify({ type: 'ping' }))
        }
      }, 15000)
    }

    _socket.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        _handleMessage(msg)
      } catch {}
    }

    _socket.onclose = () => {
      console.log('[WS] Disconnected')
      _storeRef?.getState?.()?.setWsConnected?.(false)
      clearInterval(_pingInterval)
      // Reconnect after 5 seconds
      _reconnectTimeout = setTimeout(() => _doConnect(caseId), 5000)
    }

    _socket.onerror = (e) => {
      console.warn('[WS] Error:', e)
      _socket?.close()
    }
  } catch (e) {
    console.warn('[WS] Could not connect:', e)
    // Retry after 10 seconds
    _reconnectTimeout = setTimeout(() => _doConnect(caseId), 10000)
  }
}

function _handleMessage(msg) {
  const store = _storeRef?.getState?.()
  if (!store) return

  switch (msg.type) {
    case 'risk_updated':
      if (msg.risk) store.riskData = msg.risk
      break
    case 'evidence_uploaded':
      // Trigger a full refresh
      store.fetchAll?.(store.caseId)
      break
    case 'timeline_event':
      // Append a new event to the timeline
      if (msg.event) {
        useForensicStoreDirect?.setState?.(s => ({
          timelineEvents: [...s.timelineEvents, msg.event]
        }))
      }
      break
    case 'ping':
      // Server keep-alive — do nothing
      break
    default:
      break
  }
}

export function disconnectWS() {
  clearInterval(_pingInterval)
  clearTimeout(_reconnectTimeout)
  _socket?.close()
  _socket = null
}

export function sendWS(data) {
  if (_socket?.readyState === WebSocket.OPEN) {
    _socket.send(JSON.stringify(data))
  }
}
