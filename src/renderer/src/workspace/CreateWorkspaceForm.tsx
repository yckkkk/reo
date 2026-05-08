import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  FieldControl,
  FieldError,
  FieldGroup,
  FieldHint,
  FieldLabel,
  FieldRow,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FolderPickerField } from './FolderPickerField';
import { WorkspaceErrorBanner } from './WorkspaceErrorBanner';
import {
  isSafeWorkspaceDisplayPath,
  workspaceFolderErrorMessage,
} from './workspaceFolderSelection';
import { initializeWorkspace, type WorkspaceError, type WorkspaceSession } from './workspaceApi';
import { workspaceErrorDisplayMessage } from './workspaceErrorMessages';

const workspaceNameErrorMessage = '记忆空间名称不能是 . 或 ..，也不能包含路径分隔符';

function isSafeWorkspaceName(value: string) {
  return value !== '.' && value !== '..' && !/[\\/\0]/.test(value);
}

const createWorkspaceSchema = z.object({
  title: z.string().trim().min(1, '请输入记忆空间名称').refine(isSafeWorkspaceName, {
    message: workspaceNameErrorMessage,
  }),
  description: z.string(),
  selectionToken: z.string().trim().min(1, workspaceFolderErrorMessage),
  displayPath: z
    .string()
    .trim()
    .min(1, workspaceFolderErrorMessage)
    .refine(isSafeWorkspaceDisplayPath, workspaceFolderErrorMessage),
});

type CreateWorkspaceValues = z.infer<typeof createWorkspaceSchema>;

type CreateWorkspaceFormProps = {
  readonly disabled?: boolean;
  readonly onCreateFinish: () => void;
  readonly onCreateStart: () => boolean;
  readonly onWorkspaceReady: (workspaceSession: WorkspaceSession) => boolean | Promise<boolean>;
};

function workspaceErrorMessage(error: WorkspaceError) {
  return workspaceErrorDisplayMessage(error, '无法创建记忆空间。');
}

export function CreateWorkspaceForm({
  disabled = false,
  onCreateFinish,
  onCreateStart,
  onWorkspaceReady,
}: CreateWorkspaceFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const {
    clearErrors,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
    setValue,
    watch,
  } = useForm<CreateWorkspaceValues>({
    defaultValues: {
      title: '',
      description: '',
      selectionToken: '',
      displayPath: '',
    },
    resolver: zodResolver(createWorkspaceSchema),
  });
  const displayPath = watch('displayPath');
  const titleRegistration = register('title');

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  function handleFolderError(message: string) {
    setSubmitError(null);
    setValue('selectionToken', '');
    setValue('displayPath', '');
    setError('selectionToken', { message });
  }

  const submit = handleSubmit(async (values) => {
    if (!onCreateStart()) {
      return;
    }

    setSubmitError(null);
    try {
      const response = await initializeWorkspace({
        selectionToken: values.selectionToken,
        title: values.title.trim(),
        description: values.description,
      });

      if (!response.ok) {
        setValue('selectionToken', '');
        setValue('displayPath', '');
        clearErrors(['selectionToken', 'displayPath']);
        setSubmitError(workspaceErrorMessage(response.error));
        return;
      }

      await onWorkspaceReady(response.value);
    } finally {
      onCreateFinish();
    }
  });

  return (
    <form className="flex flex-col gap-24" aria-label="创建本地记忆空间" onSubmit={submit}>
      <FieldGroup aria-label="记忆空间设置">
        <FieldRow>
          <div>
            <FieldLabel htmlFor="workspace-title">记忆空间名称</FieldLabel>
            <FieldHint>给新的记忆空间起一个名字</FieldHint>
          </div>
          <FieldControl>
            <Input
              id="workspace-title"
              size="compact"
              placeholder="记忆空间名称"
              {...titleRegistration}
              ref={(element) => {
                titleRegistration.ref(element);
                titleInputRef.current = element;
              }}
              type="text"
              disabled={disabled}
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title ? <FieldError>{errors.title.message}</FieldError> : null}
          </FieldControl>
        </FieldRow>
        <FieldRow>
          <div>
            <FieldLabel htmlFor="workspace-description">描述</FieldLabel>
            <FieldHint>补充这个记忆空间的用途，可选</FieldHint>
          </div>
          <FieldControl>
            <Textarea
              id="workspace-description"
              placeholder="例如：产品研究资料"
              disabled={disabled}
              {...register('description')}
            />
          </FieldControl>
        </FieldRow>
        <FieldRow>
          <div>
            <FieldLabel>记忆空间位置</FieldLabel>
            <FieldHint>将在所选位置下创建同名文件夹</FieldHint>
          </div>
          <FieldControl>
            <FolderPickerField
              disabled={disabled}
              displayPath={displayPath}
              error={errors.selectionToken?.message}
              onCancel={() => setSubmitError(null)}
              onError={handleFolderError}
              onSelection={(selection) => {
                setSubmitError(null);
                clearErrors(['selectionToken', 'displayPath']);
                setValue('selectionToken', selection.selectionToken, { shouldValidate: true });
                setValue('displayPath', selection.displayPath, { shouldValidate: true });
              }}
            />
          </FieldControl>
        </FieldRow>
      </FieldGroup>

      {submitError ? <WorkspaceErrorBanner>{submitError}</WorkspaceErrorBanner> : null}

      <div className="flex justify-end">
        <Button type="submit" size="compact" disabled={disabled || isSubmitting}>
          {isSubmitting ? '创建中' : '创建'}
        </Button>
      </div>
    </form>
  );
}
