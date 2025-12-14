import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { toast } from 'sonner'
import { 
  CalendarCheck, 
  CaretDown, 
  CheckCircle, 
  ClipboardText, 
  CloudSnow, 
  GithubLogo, 
  ListChecks, 
  Snowflake,
  Sun,
  Trash,
  TreePalm,
  Warning
} from '@phosphor-icons/react'
import { buildOutcomeStats, fetchOutcomeLedger, SnowDayOutcome, normalizeProbability } from '@/services/outcomes'

/** Get today's date in ISO format */
const todayISO = () => new Date().toISOString().split('T')[0]

/** Get yesterday's date in ISO format */
const yesterdayISO = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

/** Smart date: if before 10am, suggest yesterday (outcome from previous day) */
const smartDefaultDate = () => {
  const hour = new Date().getHours()
  return hour < 10 ? yesterdayISO() : todayISO()
}

/** Format a date for display */
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + 'T12:00:00')
  const today = todayISO()
  const yesterday = yesterdayISO()
  
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  
  return date.toLocaleDateString(undefined, { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  })
}

/** Holiday reason options */
const NO_SCHOOL_REASONS = [
  { value: 'weekend', label: 'Weekend' },
  { value: 'thanksgiving', label: 'Thanksgiving' },
  { value: 'winter-break', label: 'Winter Break' },
  { value: 'spring-break', label: 'Spring Break' },
  { value: 'teacher-day', label: 'Teacher In-Service' },
  { value: 'mlk-day', label: 'MLK Day' },
  { value: 'presidents-day', label: 'Presidents Day' },
  { value: 'memorial-day', label: 'Memorial Day' },
  { value: 'other', label: 'Other Holiday' },
]

const ghCommandFromForm = (form: OutcomeFormState) => {
  if (!form.outcome) return ''
  
  const parts = [
    'gh workflow run log-outcome.yml',
    '--ref development',
    `-f event_date=${form.date}`,
    `-f actual_outcome=${form.outcome}`
  ]

  if (form.outcome === 'no-school' && form.noSchoolReason.trim()) {
    parts.push(`-f no_school_reason=${form.noSchoolReason.trim()}`)
  }

  if (form.notes.trim()) {
    const sanitized = form.notes.replace(/"/g, '\\"')
    parts.push(`-f notes="${sanitized}"`)
  }

  if (form.blizzardPrediction.trim()) {
    parts.push(`-f blizzard_prediction=${form.blizzardPrediction.trim()}`)
  }

  if (form.rhsPrediction.trim()) {
    parts.push(`-f rhs_prediction=${form.rhsPrediction.trim()}`)
  }

  return parts.join(' ')
}

interface OutcomeFormState {
  date: string
  outcome: 'snow-day' | 'school-open' | 'no-school' | null
  noSchoolReason: string
  notes: string
  blizzardPrediction: string
  rhsPrediction: string
}

type QuickOutcome = 'snow-day' | 'school-open' | 'no-school'

export function OutcomeRecorder() {
  const [outcomes, setOutcomes] = useState<SnowDayOutcome[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<OutcomeFormState>({
    date: smartDefaultDate(),
    outcome: null,
    noSchoolReason: '',
    notes: '',
    blizzardPrediction: '',
    rhsPrediction: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showNoSchoolOptions, setShowNoSchoolOptions] = useState(false)
  const [copied, setCopied] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteCopied, setDeleteCopied] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const ledger = await fetchOutcomeLedger({ bustCache: true })
        setOutcomes(ledger)
      } catch (err) {
        setError('Unable to load existing outcomes. Please refresh and try again.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const stats = useMemo(() => buildOutcomeStats(outcomes), [outcomes])
  const ghCommand = useMemo(() => ghCommandFromForm(form), [form])

  // Check for pending outcomes (last 7 days without records, excluding weekends)
  const pendingDates = useMemo(() => {
    const recorded = new Set(outcomes.map(o => o.date))
    const pending: string[] = []
    const today = new Date()
    
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dayOfWeek = d.getDay()
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek === 0 || dayOfWeek === 6) continue
      
      const dateStr = d.toISOString().split('T')[0]
      if (!recorded.has(dateStr)) {
        pending.push(dateStr)
      }
    }
    return pending
  }, [outcomes])

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(ghCommand)
      setCopied(true)
      toast.success('Command copied! Paste in terminal to record.')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error('Unable to copy command. Copy manually instead.')
    }
  }

  const getDeleteCommand = (date: string) => {
    return `gh workflow run delete-outcome.yml --ref development -f event_date=${date} -f confirm=yes`
  }

  const copyDeleteCommand = async (date: string) => {
    try {
      await navigator.clipboard.writeText(getDeleteCommand(date))
      setDeleteCopied(true)
      toast.success('Delete command copied! Paste in terminal to delete.')
      setTimeout(() => setDeleteCopied(false), 2000)
    } catch (err) {
      toast.error('Unable to copy command. Copy manually instead.')
    }
  }

  const handleQuickOutcome = (outcome: QuickOutcome) => {
    if (outcome === 'no-school') {
      setShowNoSchoolOptions(true)
      setForm(prev => ({ ...prev, outcome }))
    } else {
      setShowNoSchoolOptions(false)
      setForm(prev => ({ ...prev, outcome, noSchoolReason: '' }))
    }
  }

  const handleNoSchoolReason = (reason: string) => {
    setForm(prev => ({ ...prev, noSchoolReason: reason }))
  }

  const handleDateChange = (date: string) => {
    setForm(prev => ({ ...prev, date }))
  }

  const handlePendingDateClick = (date: string) => {
    setForm(prev => ({ ...prev, date, outcome: null, noSchoolReason: '', notes: '', blizzardPrediction: '', rhsPrediction: '' }))
    setShowNoSchoolOptions(false)
  }

  const resetForm = () => {
    setForm({
      date: smartDefaultDate(),
      outcome: null,
      noSchoolReason: '',
      notes: '',
      blizzardPrediction: '',
      rhsPrediction: ''
    })
    setShowNoSchoolOptions(false)
    setCopied(false)
  }

  const isFormComplete = form.outcome !== null && (form.outcome !== 'no-school' || form.noSchoolReason)

  return (
    <div className="space-y-6 relative z-10">
      {/* Pending Outcomes Alert */}
      {pendingDates.length > 0 && (
        <Card className="rounded-2xl border border-amber-500/30 bg-background/80 backdrop-blur shadow-lg shadow-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Warning size={20} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Missing outcomes for recent school days</p>
                <div className="flex flex-wrap gap-2">
                  {pendingDates.map(date => (
                    <Button
                      key={date}
                      variant="outline"
                      size="sm"
                      onClick={() => handlePendingDateClick(date)}
                      className="text-xs"
                    >
                      {formatDate(date)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Record Card */}
      <Card className="rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck size={20} />
              Record Outcome
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">for</span>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => handleDateChange(e.target.value)}
                max={todayISO()}
                className="w-auto"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main outcome buttons */}
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant={form.outcome === 'snow-day' ? 'default' : 'outline'}
              className={`h-20 flex-col gap-2 ${form.outcome === 'snow-day' ? 'ring-2 ring-primary ring-offset-2' : ''}`}
              onClick={() => handleQuickOutcome('snow-day')}
            >
              <Snowflake size={28} weight={form.outcome === 'snow-day' ? 'fill' : 'regular'} />
              <span className="font-medium">Snow Day</span>
            </Button>
            <Button
              variant={form.outcome === 'school-open' ? 'default' : 'outline'}
              className={`h-20 flex-col gap-2 ${form.outcome === 'school-open' ? 'ring-2 ring-primary ring-offset-2' : ''}`}
              onClick={() => handleQuickOutcome('school-open')}
            >
              <Sun size={28} weight={form.outcome === 'school-open' ? 'fill' : 'regular'} />
              <span className="font-medium">School Open</span>
            </Button>
            <Button
              variant={form.outcome === 'no-school' ? 'secondary' : 'outline'}
              className={`h-20 flex-col gap-2 ${form.outcome === 'no-school' ? 'ring-2 ring-secondary ring-offset-2' : ''}`}
              onClick={() => handleQuickOutcome('no-school')}
            >
              <TreePalm size={28} weight={form.outcome === 'no-school' ? 'fill' : 'regular'} />
              <span className="font-medium">No School</span>
            </Button>
          </div>

          {/* No School reason selector */}
          {showNoSchoolOptions && (
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <p className="text-sm font-medium">Why was there no school?</p>
              <div className="flex flex-wrap gap-2">
                {NO_SCHOOL_REASONS.map(reason => (
                  <Button
                    key={reason.value}
                    variant={form.noSchoolReason === reason.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleNoSchoolReason(reason.value)}
                  >
                    {reason.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Advanced options (collapsed by default) */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                <span>Advanced options</span>
                <CaretDown size={16} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium">Blizzard AI Prediction (optional)</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="0-100"
                    value={form.blizzardPrediction}
                    onChange={(e) => setForm(prev => ({ ...prev, blizzardPrediction: e.target.value }))}
                    min={0}
                    max={100}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Manual override if the workflow missed it</p>
                </div>
                <div>
                  <label className="text-sm font-medium">RHS Prediction (optional)</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="0-100"
                    value={form.rhsPrediction}
                    onChange={(e) => setForm(prev => ({ ...prev, rhsPrediction: e.target.value }))}
                    min={0}
                    max={100}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Rockford High School's prediction</p>
                </div>
                <div className="md:col-span-3">
                  <label className="text-sm font-medium">Notes (optional)</label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Conditions, timing, etc."
                    rows={2}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Action section - only show when outcome is selected */}
          {isFormComplete && (
            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle size={18} className="text-green-500" />
                <span>
                  Ready to record: <strong>{form.outcome === 'snow-day' ? 'Snow Day' : form.outcome === 'school-open' ? 'School Open' : `No School (${form.noSchoolReason})`}</strong> for <strong>{formatDate(form.date)}</strong>
                </span>
              </div>
              
              {/* Primary action: GitHub Web UI */}
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                <div className="flex items-center gap-2">
                  <GithubLogo size={20} className="text-primary" />
                  <span className="font-medium">Easiest: Use GitHub's Web Interface</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Click below to open the workflow form. Fill in the values shown, then click "Run workflow".
                </p>
                <div className="text-xs bg-muted rounded p-2 space-y-1">
                  <div><span className="text-muted-foreground">event_date:</span> <code className="font-semibold">{form.date}</code></div>
                  <div><span className="text-muted-foreground">actual_outcome:</span> <code className="font-semibold">{form.outcome}</code></div>
                  {form.outcome === 'no-school' && form.noSchoolReason && (
                    <div><span className="text-muted-foreground">no_school_reason:</span> <code className="font-semibold">{form.noSchoolReason}</code></div>
                  )}
                  {form.notes && (
                    <div><span className="text-muted-foreground">notes:</span> <code className="font-semibold">{form.notes}</code></div>
                  )}
                  {form.blizzardPrediction && (
                    <div><span className="text-muted-foreground">blizzard_prediction:</span> <code className="font-semibold">{form.blizzardPrediction}</code></div>
                  )}
                  {form.rhsPrediction && (
                    <div><span className="text-muted-foreground">rhs_prediction:</span> <code className="font-semibold">{form.rhsPrediction}</code></div>
                  )}
                </div>
                <Button asChild className="w-full">
                  <a
                    href="https://github.com/StevenWangler/snowday-forecast/actions/workflows/log-outcome.yml"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <GithubLogo size={18} className="mr-2" />
                    Open GitHub Workflow Form
                  </a>
                </Button>
              </div>

              {/* Alternative: CLI command */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <ClipboardText size={16} />
                      Alternative: Terminal command
                    </span>
                    <CaretDown size={16} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    If you have the <a href="https://cli.github.com" target="_blank" rel="noreferrer" className="underline">GitHub CLI</a> installed, paste this in your terminal:
                  </p>
                  <div className="bg-muted rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Command</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={copyCommand}
                        className="h-7 text-xs"
                      >
                        {copied ? (
                          <>
                            <CheckCircle size={14} className="mr-1" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <ClipboardText size={14} className="mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <code className="text-xs font-mono break-all block">{ghCommand}</code>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Button variant="ghost" onClick={resetForm} className="w-full">
                Reset Form
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works - collapsed by default for returning users */}
      <Collapsible>
        <Card className="rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <CloudSnow size={18} />
                  How outcome recording works
                </span>
                <CaretDown size={16} className="text-muted-foreground" />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-3 text-sm text-muted-foreground">
              <p>
                Blizzard runs as a static site, so we use GitHub Actions to save outcomes securely.
              </p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Select the outcome above (Snow Day, School Open, or No School)</li>
                <li>Copy the generated command and run it in your terminal</li>
                <li>The workflow updates the ledger and deploys automatically</li>
              </ol>
              <p className="text-xs">
                Requires <code>gh</code> CLI with repository access. <a href="https://cli.github.com" target="_blank" rel="noreferrer" className="underline">Install GitHub CLI →</a>
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Logged Outcomes Table */}
      <Card className="rounded-2xl border border-primary/10 bg-background/80 backdrop-blur shadow-lg shadow-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks size={20} />
            Outcome History
            {stats.totalRecords > 0 && (
              <Badge variant="secondary" className="ml-2">{stats.totalRecords}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-sm text-destructive mb-4">{error}</div>
          )}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading ledger…</p>
          ) : outcomes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CloudSnow size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No outcomes logged yet.</p>
              <p className="text-xs">Record your first outcome above!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 text-sm">
                <Badge variant="outline" className="gap-1">
                  <Snowflake size={14} />
                  {stats.snowDays} Snow Days
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Sun size={14} />
                  {stats.openDays} School Open
                </Badge>
                <Badge variant="outline">
                  Accuracy: {stats.directionalAccuracy}%
                </Badge>
                {stats.avgBrierScore !== null && (
                  <Badge variant="outline">Brier: {stats.avgBrierScore}</Badge>
                )}
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>AI Prediction</TableHead>
                      <TableHead>RHS</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Recorded</TableHead>
                      <TableHead className="hidden md:table-cell">Notes</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outcomes.slice().reverse().map(entry => {
                      const modelProb = normalizeProbability(entry.modelProbability)
                      const rhsProb = normalizeProbability(entry.rhsPrediction)
                      return (
                      <React.Fragment key={`${entry.date}-${entry.recordedAt}`}>
                      <TableRow>
                        <TableCell className="whitespace-nowrap font-medium">
                          {formatDate(entry.date)}
                        </TableCell>
                        <TableCell>
                          {modelProb !== null ? (
                            <span className="flex items-center gap-1">
                              {modelProb}%
                              {entry.confidence && (
                                <span className="text-xs text-muted-foreground">({entry.confidence})</span>
                              )}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {rhsProb !== null ? `${rhsProb}%` : '—'}
                        </TableCell>
                        <TableCell>
                          {entry.noSchoolScheduled ? (
                            <Badge variant="outline" className="bg-muted gap-1">
                              <TreePalm size={12} />
                              {entry.noSchoolReason?.replace('-', ' ') || 'No School'}
                            </Badge>
                          ) : (
                            <Badge 
                              variant={entry.actualSnowDay === true ? 'destructive' : entry.actualSnowDay === false ? 'secondary' : 'outline'}
                              className="gap-1"
                            >
                              {entry.actualSnowDay === true ? (
                                <><Snowflake size={12} /> Snow Day</>
                              ) : entry.actualSnowDay === false ? (
                                <><Sun size={12} /> Open</>
                              ) : 'Pending'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs">
                            <span className="font-medium">{entry.recordedBy}</span>
                            <span className="text-muted-foreground">
                              {new Date(entry.recordedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell max-w-xs truncate text-sm text-muted-foreground">
                          {entry.notes || '—'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteTarget(deleteTarget === entry.date ? null : entry.date)}
                            title="Delete this outcome"
                          >
                            <Trash size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {deleteTarget === entry.date && (
                        <TableRow className="bg-destructive/5 border-destructive/20">
                          <TableCell colSpan={7} className="py-3">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-sm">
                                <Warning size={16} className="text-destructive" />
                                <span>Delete outcome for <strong>{formatDate(entry.date)}</strong>?</span>
                              </div>
                              
                              {/* GitHub Web UI option */}
                              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
                                <div className="flex items-center gap-2">
                                  <GithubLogo size={16} className="text-destructive" />
                                  <span className="text-sm font-medium">Use GitHub's Web Interface</span>
                                </div>
                                <div className="text-xs bg-muted rounded p-2 space-y-1">
                                  <div><span className="text-muted-foreground">event_date:</span> <code className="font-semibold">{entry.date}</code></div>
                                  <div><span className="text-muted-foreground">confirm:</span> <code className="font-semibold">yes</code></div>
                                </div>
                                <Button asChild size="sm" variant="destructive" className="w-full">
                                  <a
                                    href="https://github.com/StevenWangler/snowday-forecast/actions/workflows/delete-outcome.yml"
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <GithubLogo size={14} className="mr-2" />
                                    Open Delete Workflow
                                  </a>
                                </Button>
                              </div>

                              {/* CLI option */}
                              <Collapsible>
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground text-xs">
                                    <span className="flex items-center gap-2">
                                      <ClipboardText size={14} />
                                      Alternative: Terminal command
                                    </span>
                                    <CaretDown size={14} />
                                  </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pt-2">
                                  <div className="bg-muted rounded-md p-2">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-medium text-muted-foreground">Command</span>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => copyDeleteCommand(entry.date)}
                                        className="h-6 text-xs"
                                      >
                                        {deleteCopied ? (
                                          <><CheckCircle size={12} className="mr-1" /> Copied!</>
                                        ) : (
                                          <><ClipboardText size={12} className="mr-1" /> Copy</>
                                        )}
                                      </Button>
                                    </div>
                                    <code className="text-xs font-mono break-all block">{getDeleteCommand(entry.date)}</code>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>

                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setDeleteTarget(null)}
                                className="w-full"
                              >
                                Cancel
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      </React.Fragment>
                    )})}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
