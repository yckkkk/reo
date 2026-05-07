import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FolderPickerField } from './FolderPickerField';
import { WorkspaceErrorBanner } from './WorkspaceErrorBanner';
import {
  isSafeWorkspaceDisplayPath,
  workspaceFolderErrorMessage,
} from './workspaceFolderSelection';
import { initializeWorkspace, type WorkspaceError, type WorkspaceSession } from './workspaceApi';

const createWorkspaceSchema = z.object({
  title: z.string().trim().min(1, 'Workspace title is required'),
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
  readonly onWorkspaceReady: (workspaceSession: WorkspaceSession) => void;
};

function workspaceErrorMessage(error: WorkspaceError) {
  if (error.code === 'ERR_WORKSPACE_AGENTS_CONFLICT') {
    return 'This folder already contains AGENTS.md. Choose an empty folder for a Reo workspace.';
  }

  return error.message;
}

export function CreateWorkspaceForm({ onWorkspaceReady }: CreateWorkspaceFormProps) {
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
    setSubmitError(null);

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

    onWorkspaceReady(response.value);
  });

  return (
    <form
      className="flex flex-col gap-24"
      aria-labelledby="create-workspace-title"
      onSubmit={submit}
    >
      <header className="flex flex-col gap-12">
        <p className="font-waldenburgfh text-body font-bold uppercase leading-body text-gravel">
          Reo
        </p>
        <h1
          id="create-workspace-title"
          className="font-waldenburg text-heading-lg font-light leading-heading-lg text-obsidian"
        >
          Create workspace
        </h1>
        <p className="max-w-[560px] text-body-lg leading-body-lg text-gravel">
          Start with a local memory workspace. Reo keeps user content in this folder.
        </p>
      </header>

      <div className="flex flex-col gap-16">
        <div className="flex flex-col gap-8">
          <Label htmlFor="workspace-title">Workspace title</Label>
          <Input
            id="workspace-title"
            {...titleRegistration}
            ref={(element) => {
              titleRegistration.ref(element);
              titleInputRef.current = element;
            }}
            type="text"
            aria-invalid={Boolean(errors.title)}
          />
        </div>
        {errors.title ? (
          <p className="text-body leading-body text-ember">{errors.title.message}</p>
        ) : null}

        <div className="flex flex-col gap-8">
          <Label htmlFor="workspace-description">Description</Label>
          <Textarea id="workspace-description" className="min-h-96" {...register('description')} />
        </div>
      </div>

      <FolderPickerField
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

      {submitError ? <WorkspaceErrorBanner>{submitError}</WorkspaceErrorBanner> : null}

      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? 'Creating workspace' : 'Create workspace'}
      </Button>
    </form>
  );
}
