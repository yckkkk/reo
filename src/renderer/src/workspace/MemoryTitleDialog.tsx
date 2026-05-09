import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { WORKSPACE_TITLE_MAX_LENGTH } from '../../../workspace-contract/workspace-title';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

const memoryTitleFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, '请输入记忆名称')
    .max(WORKSPACE_TITLE_MAX_LENGTH, `记忆名称最多 ${WORKSPACE_TITLE_MAX_LENGTH} 个字符`),
});

type MemoryTitleFormValues = z.infer<typeof memoryTitleFormSchema>;

type MemoryTitleDialogProps = {
  readonly description: string;
  readonly initialTitle?: string | undefined;
  readonly labelClassName?: string | undefined;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmitTitle: (title: string) => Promise<string | null>;
  readonly open: boolean;
  readonly placeholder?: string | undefined;
  readonly submitLabel: string;
  readonly title: string;
};

export function MemoryTitleDialog({
  description,
  initialTitle = '',
  labelClassName,
  onOpenChange,
  onSubmitTitle,
  open,
  placeholder,
  submitLabel,
  title,
}: MemoryTitleDialogProps) {
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
    setFocus,
  } = useForm<MemoryTitleFormValues>({
    resolver: zodResolver(memoryTitleFormSchema),
    defaultValues: { title: initialTitle },
  });

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    reset({ title: initialTitle });
    const timer = window.setTimeout(
      () => setFocus('title', { shouldSelect: Boolean(initialTitle) }),
      0
    );

    return () => window.clearTimeout(timer);
  }, [initialTitle, open, reset, setFocus]);

  async function submit(values: MemoryTitleFormValues) {
    const saveError = await onSubmitTitle(values.title.trim());
    if (saveError) {
      setError('root', { type: 'server', message: saveError });
      return;
    }

    onOpenChange(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSubmitting) {
      return;
    }

    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:w-[min(520px,calc(100vw-(var(--spacing-40)*2)))]">
        <form
          className="flex flex-col gap-24"
          onSubmit={(event) => void handleSubmit(submit)(event)}
        >
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghostIcon"
              size="icon"
              aria-label="关闭"
              disabled={isSubmitting}
              className="absolute right-16 top-16"
            >
              <X className="size-[18px]" aria-hidden="true" />
            </Button>
          </DialogClose>
          <DialogHeader className="pr-36">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div>
            <FieldLabel htmlFor="memory-title-dialog-input" className={labelClassName}>
              记忆名称
            </FieldLabel>
            <Input
              id="memory-title-dialog-input"
              aria-invalid={Boolean(errors.title)}
              disabled={isSubmitting}
              placeholder={placeholder}
              {...register('title')}
            />
            {errors.title ? <FieldError>{errors.title.message}</FieldError> : null}
            {errors.root ? <FieldError>{errors.root.message}</FieldError> : null}
          </div>
          <div className="flex justify-end gap-12">
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isSubmitting}>
                取消
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
