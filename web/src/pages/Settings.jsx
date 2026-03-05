import { useState, useEffect, useCallback } from 'react'
import {
  Building2, Users, ShieldCheck, Bell,
  Database, Landmark, Mail, Plug,
  CheckCircle2, XCircle, Loader2, Eye, EyeOff,
  Plus, Trash2, Save, RefreshCw, AlertTriangle,
  UserPlus, Lock,
} from 'lucide-react'
import TopBar from '../components/TopBar'
import { supabase, isConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import clsx from 'clsx'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULTS = {
  // Company
  company_name:         'Acme Corp GmbH',
  base_currency:        'EUR',
  fiscal_year_start:    '1',
  // Approval rules
  approval_threshold:   '10000',
  ap_approvers:         'J. Müller, S. Weber',
  ar_approvers:         'S. Weber',
  accounting_approvers: 'M. Brandt, J. Müller',
  escalation_email:     'cfo@acmecorp.com',
  // Notifications
  notif_overdue:           true,
  notif_unmatched:         true,
  notif_approval_needed:   true,
  notif_close_ready:       false,
  // Business Central
  bc_tenant_id:     '',
  bc_client_id:     '',
  bc_client_secret: '',
  bc_environment:   'sandbox',
  bc_company_id:    '',
  // Bank
  bank_base_url:      '',
  bank_client_id:     '',
  bank_client_secret: '',
  // CRM
  crm_base_url: '',
  crm_api_key:  '',
  // Email
  email_imap_host:     '',
  email_imap_port:     '993',
  email_imap_user:     '',
  email_imap_password: '',
}

const MOCK_USERS = [
  { id: '1', name: 'Anna Fischer',  email: 'anna@acmecorp.com',   role: 'cfo',        status: 'active'  },
  { id: '2', name: 'Jonas Müller',  email: 'jonas@acmecorp.com',  role: 'ap_manager', status: 'active'  },
  { id: '3', name: 'Sophie Weber',  email: 'sophie@acmecorp.com', role: 'ar_manager', status: 'active'  },
  { id: '4', name: 'Max Brandt',    email: 'max@acmecorp.com',    role: 'ap_manager', status: 'active'  },
  { id: '5', name: 'Lena Koch',     email: 'lena@acmecorp.com',   role: 'read_only',  status: 'invited' },
]

const ROLES = [
  { value: 'cfo',        label: 'CFO'        },
  { value: 'ap_manager', label: 'AP Manager' },
  { value: 'ar_manager', label: 'AR Manager' },
  { value: 'read_only',  label: 'Read Only'  },
]

const ROLE_CFG = {
  cfo:        { bg: 'bg-brand-50',   text: 'text-brand-700',   dot: 'bg-brand-500'   },
  ap_manager: { bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-500'  },
  ar_manager: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  read_only:  { bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400'   },
}

const CURRENCIES   = ['EUR', 'USD', 'GBP', 'CHF', 'DKK', 'SEK', 'NOK']
const MONTHS       = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const INTEGRATION_CONFIGS = [
  {
    id: 'bc',
    title: 'Microsoft Business Central',
    iconCls: 'bg-blue-100 text-blue-600',
    Icon: Database,
    required: ['bc_tenant_id', 'bc_client_id', 'bc_client_secret', 'bc_company_id'],
    fields: [
      { key: 'bc_tenant_id',     label: 'Tenant ID',     type: 'text',     placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', wide: true  },
      { key: 'bc_client_id',     label: 'Client ID',     type: 'text',     placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', wide: false },
      { key: 'bc_client_secret', label: 'Client Secret', type: 'password', placeholder: '',                                      wide: false },
      { key: 'bc_environment',   label: 'Environment',   type: 'select',   options: [
          { value: 'sandbox',    label: 'Sandbox'    },
          { value: 'production', label: 'Production' },
        ], wide: false },
      { key: 'bc_company_id',    label: 'Company ID',    type: 'text',     placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', wide: false },
    ],
  },
  {
    id: 'bank',
    title: 'Bank API (Open Banking)',
    iconCls: 'bg-emerald-100 text-emerald-600',
    Icon: Landmark,
    required: ['bank_base_url', 'bank_client_id', 'bank_client_secret'],
    fields: [
      { key: 'bank_base_url',      label: 'API Base URL',  type: 'text',     placeholder: 'https://api.yourbank.com/v1', wide: true  },
      { key: 'bank_client_id',     label: 'Client ID',     type: 'text',     placeholder: 'your-client-id',             wide: false },
      { key: 'bank_client_secret', label: 'Client Secret', type: 'password', placeholder: '',                           wide: false },
    ],
  },
  {
    id: 'crm',
    title: 'CRM',
    iconCls: 'bg-violet-100 text-violet-600',
    Icon: Users,
    required: ['crm_base_url', 'crm_api_key'],
    fields: [
      { key: 'crm_base_url', label: 'CRM Base URL', type: 'text',     placeholder: 'https://api.hubspot.com/v3', wide: false },
      { key: 'crm_api_key',  label: 'API Key',      type: 'password', placeholder: '',                          wide: false },
    ],
  },
  {
    id: 'email',
    title: 'Email Inbox (IMAP)',
    iconCls: 'bg-amber-100 text-amber-600',
    Icon: Mail,
    required: ['email_imap_host', 'email_imap_user', 'email_imap_password'],
    fields: [
      { key: 'email_imap_host',     label: 'IMAP Host',               type: 'text',     placeholder: 'imap.gmail.com',       wide: false },
      { key: 'email_imap_port',     label: 'Port',                    type: 'text',     placeholder: '993',                  wide: false },
      { key: 'email_imap_user',     label: 'Email Address',           type: 'text',     placeholder: 'invoices@yourco.com',  wide: false },
      { key: 'email_imap_password', label: 'Password / App Password', type: 'password', placeholder: '',                    wide: false },
    ],
  },
]

const NOTIFICATION_ITEMS = [
  {
    key:         'notif_overdue',
    label:       'Overdue Invoices',
    description: 'Alert when a supplier or customer invoice passes its due date without payment.',
  },
  {
    key:         'notif_unmatched',
    label:       'Unmatched Payments',
    description: 'Alert when a bank payment cannot be automatically matched to an invoice.',
  },
  {
    key:         'notif_approval_needed',
    label:       'Approval Needed',
    description: 'Notify approvers when an invoice is queued for 4-eyes review.',
  },
  {
    key:         'notif_close_ready',
    label:       'Monthly Close Ready',
    description: 'Notify the CFO when all monthly close checklist items are complete.',
  },
]

const SECTIONS = [
  { id: 'integrations',   label: 'Integrations',   Icon: Plug        },
  { id: 'users',          label: 'Users & Roles',  Icon: Users       },
  { id: 'approval_rules', label: 'Approval Rules', Icon: ShieldCheck },
  { id: 'notifications',  label: 'Notifications',  Icon: Bell        },
  { id: 'company',        label: 'Company',        Icon: Building2   },
]

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI atoms
// ─────────────────────────────────────────────────────────────────────────────

function FieldLabel({ children }) {
  return (
    <label className="block text-xs font-semibold text-slate-600 mb-1.5">{children}</label>
  )
}

function TextInput({ className, ...props }) {
  return (
    <input
      className={clsx(
        'w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700',
        'placeholder-slate-400 outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all',
        className,
      )}
      {...props}
    />
  )
}

function SelectInput({ children, className, ...props }) {
  return (
    <select
      className={clsx(
        'w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700',
        'outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 transition-all',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

function SaveBtn({ onClick, saving, saved }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className={clsx(
        'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm shrink-0',
        saved    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                 : 'bg-brand-600 hover:bg-brand-700 text-white',
        saving  && 'opacity-60 cursor-not-allowed',
      )}
    >
      {saving ? (
        <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
      ) : saved ? (
        <><CheckCircle2 className="w-3.5 h-3.5" />Saved</>
      ) : (
        <><Save className="w-3.5 h-3.5" />Save changes</>
      )}
    </button>
  )
}

function Toggle({ value, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-slate-50 last:border-0">
      <div className="pr-6">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        aria-checked={value}
        className={clsx(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
          'transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-200 focus:ring-offset-1',
          value ? 'bg-brand-600' : 'bg-slate-200',
        )}
      >
        <span
          className={clsx(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow',
            'transition duration-200 ease-in-out',
            value ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  )
}

function PasswordField({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <TextInput
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder ?? '••••••••'}
        className="pr-9"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

function ConnStatusChip({ status }) {
  if (!status) return null
  const cfgs = {
    testing:    { Icon: Loader2,       cls: 'bg-slate-50 text-slate-500 border-slate-200',        label: 'Testing…',               spin: true  },
    connected:  { Icon: CheckCircle2,  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',  label: 'Connected'                            },
    error:      { Icon: XCircle,       cls: 'bg-red-50 text-red-700 border-red-200',               label: 'Connection failed'                    },
    incomplete: { Icon: AlertTriangle, cls: 'bg-amber-50 text-amber-700 border-amber-200',         label: 'Fill in required fields'              },
  }
  const { Icon, cls, label, spin } = cfgs[status] ?? cfgs.incomplete
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold border', cls)}>
      <Icon className={clsx('w-3.5 h-3.5', spin && 'animate-spin')} />
      {label}
    </span>
  )
}

function SectionHeader({ title, description, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
        {description && <p className="text-xs text-slate-400 mt-1 max-w-lg leading-relaxed">{description}</p>}
      </div>
      {action}
    </div>
  )
}

function Card({ children, className }) {
  return (
    <div className={clsx('border border-slate-100 rounded-2xl p-5 bg-slate-50/40', className)}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase hooks (inline — small enough to keep here)
// ─────────────────────────────────────────────────────────────────────────────

function useSettingsData() {
  const [values, setValues]   = useState({ ...DEFAULTS })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return }
    supabase.from('app_settings').select('key, value').then(({ data, error }) => {
      if (!error && data?.length) {
        const map = Object.fromEntries(data.map(r => [r.key, r.value]))
        setValues(prev => ({ ...prev, ...map }))
      }
      setLoading(false)
    })
  }, [])

  const saveKeys = useCallback(async (patch) => {
    setValues(prev => ({ ...prev, ...patch }))
    if (!isConfigured) return true
    const rows = Object.entries(patch).map(([key, value]) => ({ key, value }))
    const { error } = await supabase
      .from('app_settings')
      .upsert(rows, { onConflict: 'key' })
    return !error
  }, [])

  return { values, loading, saveKeys }
}

function useUsersData() {
  const [users, setUsers] = useState([...MOCK_USERS])

  useEffect(() => {
    if (!isConfigured) return
    supabase.from('app_users').select('*').order('created_at').then(({ data, error }) => {
      if (!error && data?.length) setUsers(data)
    })
  }, [])

  const invite = useCallback(async ({ name, email, role }) => {
    const newUser = { id: `local-${Date.now()}`, name, email, role, status: 'invited' }
    setUsers(prev => [...prev, newUser])
    if (!isConfigured) return true
    const { error } = await supabase
      .from('app_users')
      .insert({ name, email, role, status: 'invited' })
    return !error
  }, [])

  const remove = useCallback((id) => {
    setUsers(prev => prev.filter(u => u.id !== id))
    if (!isConfigured) return
    supabase.from('app_users').delete().eq('id', id)
  }, [])

  return { users, invite, remove }
}

// Shared save-state logic per section
function useSaveState(saveKeys) {
  const [local, setLocal]   = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  const set = (key, val) => setLocal(p => ({ ...p, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    await saveKeys(local)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    setLocal({})
  }

  return { local, set, saving, saved, handleSave }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 1 — Integrations
// ─────────────────────────────────────────────────────────────────────────────

function IntegrationBlock({ config, values, onChange }) {
  const { title, iconCls, Icon, required, fields } = config
  const [testStatus, setTestStatus] = useState(null)

  const handleTest = async () => {
    const allFilled = required.every(k => values[k]?.toString().trim())
    if (!allFilled) { setTestStatus('incomplete'); return }
    setTestStatus('testing')
    await new Promise(r => setTimeout(r, 1300))
    setTestStatus('connected')
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={clsx('flex items-center justify-center w-9 h-9 rounded-xl shrink-0', iconCls)}>
            <Icon className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-bold text-slate-700">{title}</h4>
        </div>
        <div className="flex items-center gap-2">
          {testStatus && <ConnStatusChip status={testStatus} />}
          <button
            onClick={handleTest}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Test Connection
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {fields.map(f => (
          <div key={f.key} className={f.wide ? 'col-span-2' : ''}>
            <FieldLabel>{f.label}</FieldLabel>
            {f.type === 'password' ? (
              <PasswordField
                value={values[f.key] ?? ''}
                onChange={e => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
            ) : f.type === 'select' ? (
              <SelectInput
                value={values[f.key] ?? ''}
                onChange={e => onChange(f.key, e.target.value)}
              >
                {f.options.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </SelectInput>
            ) : (
              <TextInput
                value={values[f.key] ?? ''}
                onChange={e => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

function IntegrationsSection({ values, saveKeys }) {
  const { local, set, saving, saved, handleSave } = useSaveState(saveKeys)
  const merged = { ...values, ...local }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Integrations"
        description="Configure connections to external systems. Credentials are stored in Supabase and passed to the Python agents at runtime. The Test Connection button checks that all required fields are filled — actual connectivity is verified by the backend on next run."
        action={<SaveBtn onClick={handleSave} saving={saving} saved={saved} />}
      />
      <div className="space-y-4">
        {INTEGRATION_CONFIGS.map(cfg => (
          <IntegrationBlock
            key={cfg.id}
            config={cfg}
            values={merged}
            onChange={set}
          />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 2 — Users & Roles
// ─────────────────────────────────────────────────────────────────────────────

function InviteModal({ onInvite, onClose }) {
  const [name,  setName]  = useState('')
  const [email, setEmail] = useState('')
  const [role,  setRole]  = useState('read_only')
  const [busy,  setBusy]  = useState(false)

  const submit = async () => {
    if (!email.trim()) return
    setBusy(true)
    await onInvite({ name: name.trim() || email, email: email.trim(), role })
    setBusy(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Invite Team Member</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <FieldLabel>Full Name</FieldLabel>
            <TextInput
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Anna Fischer"
            />
          </div>
          <div>
            <FieldLabel>Email Address <span className="text-red-400 font-normal">*</span></FieldLabel>
            <TextInput
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="anna@yourco.com"
            />
          </div>
          <div>
            <FieldLabel>Role</FieldLabel>
            <SelectInput value={role} onChange={e => setRole(e.target.value)}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </SelectInput>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !email.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {busy
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <UserPlus className="w-3.5 h-3.5" />
            }
            Send Invite
          </button>
        </div>
      </div>
    </div>
  )
}

function UsersSection({ users, invite, remove }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Users & Roles"
        description={`${users.length} team member${users.length !== 1 ? 's' : ''}. Invited users will receive an email with a setup link.`}
        action={
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Invite User
          </button>
        }
      />

      <div className="border border-slate-100 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              {['Member', 'Email', 'Role', 'Status', ''].map(h => (
                <th key={h} className="px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const roleCfg  = ROLE_CFG[u.role] ?? ROLE_CFG.read_only
              const roleLabel = ROLES.find(r => r.value === u.role)?.label ?? u.role
              const initials  = (u.name || u.email).slice(0, 2).toUpperCase()

              return (
                <tr
                  key={u.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors group"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-xs font-bold shrink-0">
                        {initials}
                      </div>
                      <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                        {u.name || '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-500">{u.email}</td>
                  <td className="px-5 py-3.5">
                    <span className={clsx(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold',
                      roleCfg.bg, roleCfg.text,
                    )}>
                      <span className={clsx('w-1.5 h-1.5 rounded-full', roleCfg.dot)} />
                      {roleLabel}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={clsx(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold',
                      u.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700',
                    )}>
                      <span className={clsx(
                        'w-1.5 h-1.5 rounded-full',
                        u.status === 'active' ? 'bg-emerald-500' : 'bg-amber-400',
                      )} />
                      {u.status === 'active' ? 'Active' : 'Invited'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {u.role !== 'cfo' && (
                      <button
                        onClick={() => remove(u.id)}
                        className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        title="Remove user"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <InviteModal onInvite={invite} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 3 — Approval Rules
// ─────────────────────────────────────────────────────────────────────────────

function ApprovalRulesSection({ values, saveKeys }) {
  const { local, set, saving, saved, handleSave } = useSaveState(saveKeys)
  const merged = { ...values, ...local }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Approval Rules"
        description="Configure the 4-eyes approval threshold and default approvers. Invoices above the threshold require two independent approvals before payment is queued."
        action={<SaveBtn onClick={handleSave} saving={saving} saved={saved} />}
      />

      {/* Threshold */}
      <Card className="space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-0.5">4-Eyes Approval Threshold</h4>
          <p className="text-xs text-slate-400">Invoices at or above this amount require two distinct approvers before queuing for payment.</p>
        </div>
        <div className="flex items-center gap-3 max-w-xs">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium select-none">€</span>
            <TextInput
              type="number"
              min="0"
              step="1000"
              value={merged.approval_threshold}
              onChange={e => set('approval_threshold', e.target.value)}
              className="pl-7"
              placeholder="10000"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {merged.base_currency || values.base_currency || 'EUR'}
          </span>
        </div>
      </Card>

      {/* Approvers per agent */}
      <Card className="space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-0.5">Default Approvers per Agent</h4>
          <p className="text-xs text-slate-400">Comma-separated approver names. The Python agent assigns the first two as primary approvers.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <FieldLabel>AP Agent</FieldLabel>
            <TextInput
              value={merged.ap_approvers}
              onChange={e => set('ap_approvers', e.target.value)}
              placeholder="J. Müller, S. Weber"
            />
          </div>
          <div>
            <FieldLabel>AR Agent</FieldLabel>
            <TextInput
              value={merged.ar_approvers}
              onChange={e => set('ar_approvers', e.target.value)}
              placeholder="S. Weber"
            />
          </div>
          <div>
            <FieldLabel>Accounting Agent</FieldLabel>
            <TextInput
              value={merged.accounting_approvers}
              onChange={e => set('accounting_approvers', e.target.value)}
              placeholder="M. Brandt, J. Müller"
            />
          </div>
        </div>
      </Card>

      {/* Escalation */}
      <Card className="space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-0.5">Escalation</h4>
          <p className="text-xs text-slate-400">If an invoice is not approved within 24 hours, an escalation email is sent to this address.</p>
        </div>
        <div className="max-w-sm">
          <FieldLabel>Escalation Email</FieldLabel>
          <TextInput
            type="email"
            value={merged.escalation_email}
            onChange={e => set('escalation_email', e.target.value)}
            placeholder="cfo@yourco.com"
          />
        </div>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 4 — Notifications
// ─────────────────────────────────────────────────────────────────────────────

function NotificationsSection({ values, saveKeys }) {
  const { local, set, saving, saved, handleSave } = useSaveState(saveKeys)
  const merged = { ...values, ...local }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Notifications"
        description="Control which events trigger alerts in the dashboard and email notifications."
        action={<SaveBtn onClick={handleSave} saving={saving} saved={saved} />}
      />

      <Card>
        {NOTIFICATION_ITEMS.map(item => (
          <Toggle
            key={item.key}
            value={Boolean(merged[item.key])}
            onChange={val => set(item.key, val)}
            label={item.label}
            description={item.description}
          />
        ))}
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 5 — Company
// ─────────────────────────────────────────────────────────────────────────────

function CompanySection({ values, saveKeys }) {
  const { local, set, saving, saved, handleSave } = useSaveState(saveKeys)
  const merged = { ...values, ...local }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Company"
        description="Basic company settings used across all agents and reports."
        action={<SaveBtn onClick={handleSave} saving={saving} saved={saved} />}
      />

      <Card className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FieldLabel>Company Name</FieldLabel>
            <TextInput
              value={merged.company_name}
              onChange={e => set('company_name', e.target.value)}
              placeholder="Acme Corp GmbH"
            />
          </div>
          <div>
            <FieldLabel>Base Currency</FieldLabel>
            <SelectInput
              value={merged.base_currency}
              onChange={e => set('base_currency', e.target.value)}
            >
              {CURRENCIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </SelectInput>
          </div>
          <div>
            <FieldLabel>Fiscal Year Start Month</FieldLabel>
            <SelectInput
              value={merged.fiscal_year_start}
              onChange={e => set('fiscal_year_start', e.target.value)}
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={String(i + 1)}>{m}</option>
              ))}
            </SelectInput>
          </div>
        </div>
      </Card>

      <div className="flex items-start gap-3 p-4 rounded-2xl bg-brand-50 border border-brand-100">
        <Lock className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
        <p className="text-xs text-brand-600 leading-relaxed">
          These settings are read by the Python agents at startup. After saving, restart the orchestrator for changes to take effect.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [activeSection, setActiveSection] = useState('integrations')
  const { values, loading, saveKeys }     = useSettingsData()
  const { users, invite, remove }         = useUsersData()
  const { role }                          = useAuth()

  const canAccess = role === 'cfo'

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <TopBar
        title="Settings"
        subtitle="System configuration · CFO & Admin only"
      />

      <main className="flex-1 px-8 py-6 max-w-[1200px] w-full mx-auto">
        {!canAccess ? (
          <div className="flex flex-col items-center justify-center h-80 gap-3 text-slate-400">
            <Lock className="w-10 h-10" />
            <p className="text-sm font-semibold">Access restricted to CFO and Admin roles</p>
          </div>
        ) : (
          <div className="flex gap-6 items-start">
            {/* Left nav */}
            <nav className="w-52 shrink-0 sticky top-24">
              <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-2 space-y-0.5">
                {SECTIONS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveSection(id)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all text-left',
                      activeSection === id
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800',
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </nav>

            {/* Content panel */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6">
                {loading ? (
                  <div className="flex items-center gap-2.5 text-slate-400 py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading settings…</span>
                  </div>
                ) : (
                  <>
                    {activeSection === 'integrations'   && <IntegrationsSection  values={values} saveKeys={saveKeys} />}
                    {activeSection === 'users'          && <UsersSection         users={users}   invite={invite}    remove={remove} />}
                    {activeSection === 'approval_rules' && <ApprovalRulesSection values={values} saveKeys={saveKeys} />}
                    {activeSection === 'notifications'  && <NotificationsSection values={values} saveKeys={saveKeys} />}
                    {activeSection === 'company'        && <CompanySection       values={values} saveKeys={saveKeys} />}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
