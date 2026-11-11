import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NumberStepInput } from '../number-step-input';
import type { RpaSpeed } from '../../types';

export interface TaskVariable {
  id: string;
  name: string;
  value: string;
  promptOnRun: boolean;
  required: boolean;
}

export interface TaskConfig {
  name: string;
  description: string;
  tags: string[];
  triggerType: 'manual' | 'scheduled';
  schedule?: string;
  cronExpression?: string;
  selectedEnvironments: string[];
  runMode: 'sequential' | 'parallel';
  globalVariables: TaskVariable[];
  retryCount: number;
  retryInterval: number;
  timeout: number;
  concurrency: number;
  stopOnError: boolean;
  closeBrowserOnComplete: boolean;
  notifyOnComplete: boolean;
  notifyOnError: boolean;
  speed: RpaSpeed;
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="text-xs text-foreground">{label}</div>
        {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segments<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<[T, string]>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md bg-muted p-0.5">
      {options.map(([optionValue, label]) => (
        <button
          type="button"
          key={optionValue}
          onClick={() => onChange(optionValue)}
          className={`rounded px-3 py-1 text-xs transition-colors ${
            value === optionValue ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function TaskSettingsForm({
  config,
  onConfigChange,
}: {
  config: TaskConfig;
  onConfigChange: (config: TaskConfig) => void;
}) {
  const { t } = useTranslation('rpa');
  const [tagDraft, setTagDraft] = useState('');
  const change = <K extends keyof TaskConfig>(key: K, value: TaskConfig[K]) => onConfigChange({ ...config, [key]: value });

  const addTag = () => {
    const value = tagDraft.trim();
    if (value && !config.tags.includes(value)) change('tags', [...config.tags, value]);
    setTagDraft('');
  };

  const number = (key: 'retryCount' | 'retryInterval' | 'timeout' | 'concurrency', label: string, min: number, suffix?: string) => (
    <Row label={label}>
      <div className="flex items-center gap-2">
        <NumberStepInput
          value={config[key]}
          min={min}
          onChange={(value) => change(key, Math.max(min, Math.trunc(value)))}
          decreaseLabel={t('editor.config.decrease', { label })}
          increaseLabel={t('editor.config.increase', { label })}
        />
        {suffix ? <span className="w-4 text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
    </Row>
  );

  const toggle = (key: 'stopOnError' | 'closeBrowserOnComplete' | 'notifyOnComplete' | 'notifyOnError', label: string, hint?: string) => (
    <Row label={label} hint={hint}>
      <Switch checked={config[key]} onCheckedChange={(value) => change(key, value)} />
    </Row>
  );

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 pr-2">
        <section className="space-y-2">
          <h4 className="text-xs font-semibold text-foreground">{t('editor.settingsForm.basic')}</h4>
          <Input
            value={config.name}
            onChange={(event) => change('name', event.target.value)}
            placeholder={t('editor.taskNamePlaceholder')}
            className="h-8 text-xs"
          />
          <Input
            value={config.description}
            onChange={(event) => change('description', event.target.value)}
            placeholder={t('editor.settingsForm.descriptionPlaceholder')}
            className="h-8 text-xs"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {config.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 px-2 py-0.5 text-[10px]">
                {tag}
                <button
                  type="button"
                  aria-label={t('editor.settingsForm.removeTag', { tag })}
                  onClick={() => change('tags', config.tags.filter((item) => item !== tag))}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Input
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTag();
                }
              }}
              placeholder={t('editor.settingsForm.tagPlaceholder')}
              className="h-7 w-32 text-xs"
            />
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={addTag}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </section>

        <section>
          <h4 className="text-xs font-semibold text-foreground">{t('editor.settingsForm.trigger')}</h4>
          <Row label={t('editor.settingsForm.triggerType')}>
            <Segments
              value={config.triggerType}
              onChange={(value) => change('triggerType', value)}
              options={[
                ['manual', t('editor.trigger.manual')],
                ['scheduled', t('editor.trigger.scheduled')],
              ]}
            />
          </Row>
          {config.triggerType === 'scheduled' ? (
            <>
              <Row label={t('editor.trigger.schedule')} hint={t('editor.settingsForm.scheduleHint')}>
                <Select value={config.schedule || ''} onValueChange={(value) => change('schedule', value)}>
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue placeholder={t('editor.trigger.selectSchedule')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">{t('editor.trigger.hourly')}</SelectItem>
                    <SelectItem value="daily">{t('editor.trigger.daily')}</SelectItem>
                    <SelectItem value="weekly">{t('editor.trigger.weekly')}</SelectItem>
                    <SelectItem value="custom">{t('editor.trigger.custom')}</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              {config.schedule === 'custom' ? (
                <Row label={t('editor.trigger.cronExpression')}>
                  <Input
                    value={config.cronExpression || ''}
                    onChange={(event) => change('cronExpression', event.target.value)}
                    placeholder="0 9 * * *"
                    className="h-8 w-36 font-mono text-xs"
                  />
                </Row>
              ) : null}
            </>
          ) : null}
        </section>

        <section>
          <h4 className="text-xs font-semibold text-foreground">{t('editor.settingsForm.execution')}</h4>
          <Row label={t('editor.settingsForm.speed')} hint={t('editor.settingsForm.speedHint')}>
            <Segments
              value={config.speed}
              onChange={(value) => change('speed', value)}
              options={[
                ['fast', t('editor.settingsForm.speedFast')],
                ['normal', t('editor.settingsForm.speedNormal')],
                ['slow', t('editor.settingsForm.speedSlow')],
              ]}
            />
          </Row>
          <Row label={t('editor.settingsForm.runMode')}>
            <Segments
              value={config.runMode}
              onChange={(value) => change('runMode', value)}
              options={[
                ['sequential', t('editor.environments.sequential')],
                ['parallel', t('editor.environments.parallel')],
              ]}
            />
          </Row>
          {config.runMode === 'parallel' ? number('concurrency', t('editor.settingsForm.concurrency'), 1) : null}
          {number('retryCount', t('editor.settingsForm.retryCount'), 0)}
          {config.retryCount > 0 ? number('retryInterval', t('editor.settingsForm.retryInterval'), 0, t('editor.settingsForm.seconds')) : null}
          {number('timeout', t('editor.settingsForm.timeout'), 0, t('editor.settingsForm.seconds'))}
          {toggle('stopOnError', t('editor.settingsForm.stopOnError'), t('editor.settingsForm.stopOnErrorHint'))}
          {toggle('closeBrowserOnComplete', t('editor.settingsForm.closeBrowser'), t('editor.settingsForm.closeBrowserHint'))}
          {toggle('notifyOnComplete', t('editor.settingsForm.notifyOnComplete'))}
          {toggle('notifyOnError', t('editor.settingsForm.notifyOnError'))}
        </section>
      </div>
    </ScrollArea>
  );
}
