import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import { Crosshair, Loader2, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NumberStepInput } from '../number-step-input';
import type { EditorStep } from '../../lib/step-tree';
import type { StepPreview } from '../../hooks/use-editor-run';
import { NAMED_KEYS } from '../../runtime/human-input';
import type { RpaValidationCode } from '../../runtime/validate-workflow';

interface PropertyPanelProps {
  step: EditorStep | null;
  preview?: StepPreview;
  issue?: RpaValidationCode;
  picking: boolean;
  pickDisabled: boolean;
  onUpdateStep: (step: EditorStep, mergeKey?: string) => void;
  onPick: (step: EditorStep) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function SwitchField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

const SELECTOR_TYPES = ['css', 'xpath', 'text', 'role', 'label', 'placeholder', 'testid'] as const;

export function PropertyPanel({ step, preview, issue, picking, pickDisabled, onUpdateStep, onPick }: PropertyPanelProps) {
  const { t } = useTranslation('rpa');

  if (!step) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center overflow-hidden bg-background p-4">
        <Settings className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">{t('editor.selectStepToEdit')}</p>
      </div>
    );
  }

  const config = step.config;
  const text = (key: string, fallback = '') => (typeof config[key] === 'string' ? (config[key] as string) : fallback);
  const number = (key: string, fallback: number) => (typeof config[key] === 'number' ? (config[key] as number) : fallback);
  const set = (key: string, value: unknown) => onUpdateStep({ ...step, config: { ...config, [key]: value } });
  // 连续打字合并成一步撤销
  const typeInto = (key: string, value: string) =>
    onUpdateStep({ ...step, config: { ...config, [key]: value } }, `${step.id}:${key}`);

  const textField = (key: string, label: string, placeholder?: string) => (
    <Field label={label}>
      <Input
        value={text(key)}
        onChange={(event) => typeInto(key, event.target.value)}
        placeholder={placeholder}
        className="h-8 text-xs"
      />
    </Field>
  );

  const numberField = (key: string, label: string, fallback: number, min: number, suffix?: string) => (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <NumberStepInput
          value={number(key, fallback)}
          min={min}
          onChange={(value) => set(key, Math.max(min, Math.trunc(value)))}
          className="w-full"
          inputClassName="w-full px-3 text-left text-xs"
          decreaseLabel={t('editor.config.decrease', { label })}
          increaseLabel={t('editor.config.increase', { label })}
        />
        {suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
    </Field>
  );

  const timeoutField = numberField('timeout', t('editor.config.elementTimeout'), 10000, 0, 'ms');

  const targetField = () => {
    const by = text('selectorBy') || (text('selector').startsWith('/') ? 'xpath' : 'css');
    const candidates = Array.isArray(config.selectorCandidates) ? config.selectorCandidates.length : 0;
    const inFrame = Array.isArray(config.selectorFrames) && config.selectorFrames.length > 0;
    return (
      <Field label={t('editor.config.selector')}>
        <div className="flex gap-1.5">
          <Select value={by} onValueChange={(value) => set('selectorBy', value)}>
            <SelectTrigger className="h-8 w-24 shrink-0 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SELECTOR_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`editor.config.selectorTypes.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={text('selector')}
            onChange={(event) =>
              onUpdateStep(
                {
                  ...step,
                  config: {
                    ...config,
                    selector: event.target.value,
                    selectorCandidates: [],
                    selectorFrames: [],
                    similarSelector: '',
                    similarCount: 0,
                  },
                },
                `${step.id}:selector`
              )
            }
            placeholder={t('editor.config.selectorPlaceholder')}
            className="h-8 min-w-0 flex-1 text-xs"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-full gap-1.5 text-xs"
          disabled={pickDisabled}
          onClick={() => onPick(step)}
        >
          {picking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
          {picking ? t('editor.config.picking') : t('editor.config.pick')}
        </Button>
        {candidates > 0 || inFrame ? (
          <p className="text-[11px] text-muted-foreground">
            {inFrame ? `${t('editor.config.inFrame')} ` : ''}
            {candidates > 0 ? t('editor.config.candidates', { count: candidates }) : ''}
          </p>
        ) : null}
      </Field>
    );
  };

  const handlePickUploadFile = async () => {
    const selected = await openFileDialog({ multiple: false, directory: false });
    if (typeof selected === 'string' && selected.trim()) set('filePath', selected);
  };

  const outputField = textField('outputKey', t('editor.config.outputKey'), t('editor.config.outputKeyPlaceholder'));
  const valuePreview = (
    <Field label={t('editor.config.resultPreview')}>
      <div className="break-all rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        {preview?.value || t('editor.config.noPreview')}
      </div>
    </Field>
  );

  const renderConfig = () => {
    switch (step.type) {
      case 'navigate':
        return (
          <>
            {textField('url', t('editor.config.url'), 'https://example.com')}
            <SwitchField
              label={t('editor.config.newTab')}
              checked={config.newTab !== false}
              onChange={(value) => set('newTab', value)}
            />
            <SwitchField
              label={t('editor.config.waitForLoad')}
              checked={config.waitForLoad !== false}
              onChange={(value) => set('waitForLoad', value)}
            />
          </>
        );
      case 'click':
        return (
          <>
            {targetField()}
            <SelectField
              label={t('editor.config.clickType')}
              value={text('clickType', 'single')}
              onChange={(value) => set('clickType', value)}
              options={[
                ['single', t('editor.config.singleClick')],
                ['double', t('editor.config.doubleClick')],
                ['right', t('editor.config.rightClick')],
              ]}
            />
            {timeoutField}
          </>
        );
      case 'hover':
        return (
          <>
            {targetField()}
            {timeoutField}
          </>
        );
      case 'input':
        return (
          <>
            {targetField()}
            <Field label={t('editor.config.inputText')}>
              <Textarea
                value={text('text')}
                onChange={(event) => typeInto('text', event.target.value)}
                placeholder={t('editor.config.inputTextPlaceholder', { token: `{{${t('editor.variablePanel.variableToken')}}}` })}
                className="min-h-[60px] resize-none text-xs"
              />
            </Field>
            <SwitchField
              label={t('editor.config.clearFirst')}
              checked={config.clearFirst !== false}
              onChange={(value) => set('clearFirst', value)}
            />
            {timeoutField}
          </>
        );
      case 'press_key':
        return (
          <SelectField
            label={t('editor.config.key')}
            value={text('key', 'Enter')}
            onChange={(value) => set('key', value)}
            options={Object.keys(NAMED_KEYS).map((key) => [key, key])}
          />
        );
      case 'select_option':
        return (
          <>
            {targetField()}
            <SelectField
              label={t('editor.config.optionBy')}
              value={text('optionBy', 'label')}
              onChange={(value) => set('optionBy', value)}
              options={[
                ['label', t('editor.config.optionByLabel')],
                ['value', t('editor.config.optionByValue')],
              ]}
            />
            {textField('optionValue', t('editor.config.optionValue'))}
            {timeoutField}
          </>
        );
      case 'screenshot':
        return (
          <>
            <SelectField
              label={t('editor.config.captureMode')}
              value={text('captureMode', 'viewport')}
              onChange={(value) => set('captureMode', value)}
              options={[
                ['viewport', t('editor.config.viewportScreenshot')],
                ['full_page', t('editor.config.fullPageScreenshot')],
                ['element', t('editor.config.elementScreenshot')],
              ]}
            />
            {config.captureMode === 'element' ? targetField() : null}
            <Field label={t('editor.config.screenshotPreview')}>
              {preview?.screenshot ? (
                <img src={preview.screenshot} alt="" className="block h-auto w-full rounded-md border border-border" />
              ) : (
                <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  {t('editor.config.noPreview')}
                </div>
              )}
            </Field>
          </>
        );
      case 'scroll': {
        const mode = text('scrollMode', 'to_element');
        return (
          <>
            <SelectField
              label={t('editor.config.scrollMode')}
              value={mode}
              onChange={(value) => set('scrollMode', value)}
              options={[
                ['to_element', t('editor.config.scrollToElement')],
                ['by_viewport', t('editor.config.scrollByViewport')],
                ['to_edge', t('editor.config.scrollToEdge')],
              ]}
            />
            {mode === 'to_element' ? targetField() : null}
            {mode === 'by_viewport' ? (
              <>
                <SelectField
                  label={t('editor.config.scrollDirection')}
                  value={text('direction', 'down')}
                  onChange={(value) => set('direction', value)}
                  options={[
                    ['down', t('editor.config.scrollDown')],
                    ['up', t('editor.config.scrollUp')],
                  ]}
                />
                {numberField('viewportCount', t('editor.config.viewportCount'), 1, 1)}
              </>
            ) : null}
            {mode === 'to_edge' ? (
              <SelectField
                label={t('editor.config.scrollEdge')}
                value={text('edge', 'bottom')}
                onChange={(value) => set('edge', value)}
                options={[
                  ['top', t('editor.config.scrollTop')],
                  ['bottom', t('editor.config.scrollBottom')],
                ]}
              />
            ) : null}
          </>
        );
      }
      case 'select_tab':
      case 'close_tab':
        return numberField('tabIndex', t('editor.config.tabIndex'), 1, 1);
      case 'wait': {
        const waitType = text('waitType', 'time');
        return (
          <>
            <SelectField
              label={t('editor.config.waitType')}
              value={waitType}
              onChange={(value) => set('waitType', value)}
              options={[
                ['time', t('editor.config.waitTime')],
                ['element', t('editor.config.waitElement')],
              ]}
            />
            {waitType === 'time' ? numberField('duration', t('editor.config.duration'), 1000, 0, 'ms') : null}
            {waitType === 'element' ? (
              <>
                {targetField()}
                {timeoutField}
              </>
            ) : null}
          </>
        );
      }
      case 'condition': {
        const conditionType = text('conditionType', 'element_visible');
        return (
          <>
            <SelectField
              label={t('editor.condition.typeLabel')}
              value={conditionType}
              onChange={(value) => set('conditionType', value)}
              options={[
                ['element_visible', t('editor.condition.elementVisible')],
                ['text_present', t('editor.condition.textPresent')],
                ['url_contains', t('editor.condition.urlContains')],
              ]}
            />
            {conditionType === 'element_visible' ? targetField() : null}
            {conditionType === 'text_present' ? textField('expectedText', t('editor.condition.textValue')) : null}
            {conditionType === 'url_contains' ? textField('urlFragment', t('editor.condition.urlValue')) : null}
          </>
        );
      }
      case 'loop':
        return numberField('iterations', t('editor.config.iterations'), 3, 1);
      case 'extract':
        return (
          <>
            {targetField()}
            <SelectField
              label={t('editor.config.extractType')}
              value={text('extractType', 'text')}
              onChange={(value) => set('extractType', value)}
              options={[
                ['text', t('editor.config.extractText')],
                ['href', t('editor.config.extractHref')],
                ['value', t('editor.config.extractValue')],
                ['html', t('editor.config.extractHtml')],
                ['attribute', t('editor.config.extractAttribute')],
              ]}
            />
            {config.extractType === 'attribute' ? textField('attribute', t('editor.config.attributeName')) : null}
            <SwitchField
              label={t('editor.config.extractAll')}
              checked={config.extractAll === true}
              onChange={(checked) =>
                onUpdateStep({
                  ...step,
                  config: {
                    ...config,
                    extractAll: checked,
                    // 先拾取后打开开关时，换成拾取时算好的同类选择器
                    ...(checked && text('similarSelector')
                      ? { selector: text('similarSelector'), selectorBy: 'css', selectorCandidates: [] }
                      : {}),
                  },
                })
              }
            />
            {config.extractAll === true ? (
              <p className="text-[11px] text-muted-foreground">
                {number('similarCount', 0) > 0 && text('selector') === text('similarSelector')
                  ? t('editor.config.similarCount', { count: number('similarCount', 0) })
                  : t('editor.config.extractAllHint')}
              </p>
            ) : null}
            {outputField}
            {timeoutField}
            {valuePreview}
          </>
        );
      case 'set_variable':
        return (
          <>
            {textField('variableName', t('editor.config.variableName'))}
            {textField('variableValue', t('editor.config.variableValue'))}
          </>
        );
      case 'upload':
        return (
          <>
            {targetField()}
            <Field label={t('editor.config.localFile')}>
              <div className="flex gap-2">
                <Input value={text('filePath')} readOnly className="h-8 text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => void handlePickUploadFile()}
                >
                  {t('editor.config.chooseFile')}
                </Button>
              </div>
            </Field>
            {timeoutField}
          </>
        );
      case 'script':
        return (
          <>
            <SwitchField
              label={t('editor.config.localExecution')}
              checked={config.executionMode === 'local'}
              onChange={(checked) => set('executionMode', checked ? 'local' : 'browser')}
            />
            <Field label={t('editor.config.script')}>
              <Textarea
                value={text('script')}
                onChange={(event) => typeInto('script', event.target.value)}
                placeholder="return document.title;"
                className="h-[120px] w-full resize-none overflow-y-auto whitespace-pre-wrap break-all font-mono text-xs"
              />
            </Field>
            {outputField}
            {valuePreview}
          </>
        );
      default:
        return <p className="py-2 text-center text-xs text-muted-foreground">{t('editor.configNotAvailable')}</p>;
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <ScrollArea className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-3 p-3">
          <Field label={t('editor.config.stepName')}>
            <Input
              value={step.name}
              onChange={(event) => onUpdateStep({ ...step, name: event.target.value }, `${step.id}:name`)}
              className="h-8 text-xs"
            />
          </Field>
          {renderConfig()}
          {issue ? <p className="text-[11px] text-warning">{t(`editor.validation.${issue}`)}</p> : null}
        </div>
      </ScrollArea>
    </div>
  );
}
