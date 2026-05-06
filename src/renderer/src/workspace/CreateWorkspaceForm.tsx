import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  chooseWorkspaceDirectory,
  initializeWorkspace,
  type WorkspaceDirectorySelection,
  type WorkspaceError,
  type WorkspaceSession,
} from './workspaceApi';

const createWorkspaceSchema = z.object({
  title: z.string().trim().min(1, 'Enter a workspace title.'),
  description: z.string(),
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
  const [folderSelection, setFolderSelection] = useState<WorkspaceDirectorySelection | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const folderButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    watch,
  } = useForm<CreateWorkspaceValues>({
    defaultValues: {
      title: '',
      description: '',
    },
    resolver: zodResolver(createWorkspaceSchema),
  });
  const titleValue = watch('title');
  const titleRegistration = register('title');
  const canSubmit = Boolean(folderSelection && titleValue.trim()) && !isSubmitting;

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  async function handleChooseFolder() {
    setFolderError(null);
    setSubmitError(null);

    const response = await chooseWorkspaceDirectory();

    if (!response.ok) {
      setFolderError(response.error.message);
      folderButtonRef.current?.focus();
      return;
    }

    if (response.value.status === 'canceled') {
      folderButtonRef.current?.focus();
      return;
    }

    setFolderSelection(response.value);
  }

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);

    if (!folderSelection) {
      setFolderError('Choose a folder before creating the workspace.');
      folderButtonRef.current?.focus();
      return;
    }

    const response = await initializeWorkspace({
      selectionToken: folderSelection.selectionToken,
      title: values.title.trim(),
      description: values.description,
    });

    if (!response.ok) {
      setSubmitError(workspaceErrorMessage(response.error));
      return;
    }

    onWorkspaceReady(response.value);
  });

  return (
    <form
      className="mx-auto flex w-full max-w-[720px] flex-col gap-24 px-24 py-40 sm:px-40"
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
          <input
            id="workspace-title"
            {...titleRegistration}
            ref={(element) => {
              titleRegistration.ref(element);
              titleInputRef.current = element;
            }}
            className="min-h-48 border border-chalk bg-card-white px-16 text-body-lg leading-body-lg text-obsidian outline-none focus:border-signal-blue"
            type="text"
            aria-invalid={Boolean(errors.title)}
          />
        </div>
        {errors.title ? (
          <p className="text-body leading-body text-ember">{errors.title.message}</p>
        ) : null}

        <div className="flex flex-col gap-8">
          <Label htmlFor="workspace-description">Description</Label>
          <textarea
            id="workspace-description"
            className="min-h-96 resize-none border border-chalk bg-card-white px-16 py-12 text-body-lg leading-body-lg text-obsidian outline-none focus:border-signal-blue"
            {...register('description')}
          />
        </div>
      </div>

      <section className="flex flex-col gap-12" aria-label="Workspace folder">
        <div className="flex flex-col gap-12 sm:flex-row sm:items-center">
          <Button
            ref={folderButtonRef}
            type="button"
            variant="default"
            onClick={handleChooseFolder}
          >
            Choose folder
          </Button>
          {folderSelection ? (
            <p className="text-body leading-body text-cinder" aria-label="Selected folder">
              {folderSelection.displayPath}
            </p>
          ) : (
            <p className="text-body leading-body text-gravel">No folder selected.</p>
          )}
        </div>
        {folderError ? (
          <p className="text-body leading-body text-ember" role="alert">
            {folderError}
          </p>
        ) : null}
      </section>

      {submitError ? (
        <p className="text-body leading-body text-ember" role="alert">
          {submitError}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={!canSubmit}>
        Create workspace
      </Button>
    </form>
  );
}
