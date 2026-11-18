'use client'

import { useMemo, useState } from 'react'
import { CircleAlert, CircleCheck, Loader2, MessageSquare, Search, Send } from 'lucide-react'
import { maskTzPhone } from '@/lib/bet/phone'

export interface SmsUserOption {
  id: string
  name: string | null
  email: string
  phone: string
}

interface SendSmsResponse {
  error?: string
  success?: boolean
  sentCount?: number
  failedCount?: number
  messageIds?: string[]
}

export function AdminSendSmsForm({ users }: { users: SmsUserOption[] }) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return users
    return users.filter(user =>
      [user.name ?? '', user.email, user.phone].some(value => value.toLowerCase().includes(needle)),
    )
  }, [search, users])

  const selectedUserId = selectedId && filtered.some(user => user.id === selectedId)
    ? selectedId
    : (filtered[0]?.id ?? '')

  const selectedUser = filtered.find(user => user.id === selectedUserId)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)
    if (!selectedUserId) {
      setNotice({ kind: 'error', text: 'Choose a user with a registered mobile number.' })
      return
    }
    if (!message.trim()) {
      setNotice({ kind: 'error', text: 'Enter the message to send.' })
      return
    }

    setPending(true)
    try {
      const response = await fetch('/api/admin/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, message: message.trim() }),
      })
      const data = (await response.json().catch(() => ({}))) as SendSmsResponse
      if (!response.ok) {
        setNotice({
          kind: 'error',
          text: data.error ?? 'The SMS could not be sent. Check the sender ID configuration.',
        })
        return
      }
      setNotice({
        kind: 'ok',
        text: `SMS sent to ${selectedUser?.name ?? selectedUser?.email ?? 'the selected user'} (${maskTzPhone(selectedUser?.phone ?? '')}).`,
      })
      setMessage('')
    } catch {
      setNotice({ kind: 'error', text: 'The SMS request failed. Please try again.' })
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface/60 p-4">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-main-text">
        <MessageSquare className="h-4 w-4 text-accent" />
        Send a direct SMS
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-text">
        Pick a user who has saved a mobile number in their profile. Selections and messages are
        written to the admin audit log.
      </p>

      {users.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-border bg-background/40 p-4 text-xs text-muted-text">
          No users have a registered mobile number yet.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Find user</span>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2 focus-within:border-accent/60">
              <Search className="h-3.5 w-3.5 text-muted-text" />
              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Name, email or phone"
                className="w-full bg-transparent text-xs text-main-text outline-none placeholder:text-muted-text/60"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Recipient</span>
            <select
              value={selectedUserId}
              onChange={event => setSelectedId(event.target.value)}
              className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-xs font-semibold text-main-text outline-none focus:border-accent/60"
            >
              {filtered.length === 0 ? <option value="">No matching users</option> : null}
              {filtered.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name ?? 'Unnamed account'} · {user.email} · {maskTzPhone(user.phone)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-muted-text">Message</span>
            <textarea
              value={message}
              onChange={event => setMessage(event.target.value)}
              maxLength={480}
              rows={4}
              placeholder="Type the message to deliver to this user."
              className="w-full resize-y rounded-xl border border-border bg-background/50 px-3 py-2.5 text-xs leading-relaxed text-main-text outline-none focus:border-accent/60"
            />
            <span className="mt-1 block text-right text-[10px] text-muted-text">
              {message.length}/480
            </span>
          </label>

          {notice ? (
            <p
              className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${
                notice.kind === 'ok'
                  ? 'border-accent/25 bg-accent/10 text-accent'
                  : 'border-red-400/25 bg-red-400/10 text-red-200'
              }`}
            >
              {notice.kind === 'ok' ? (
                <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              ) : (
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              {notice.text}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending || !selectedUserId}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {pending ? 'Sending…' : 'Send SMS'}
          </button>
        </form>
      )}
    </section>
  )
}
