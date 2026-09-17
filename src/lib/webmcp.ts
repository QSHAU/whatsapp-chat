interface ModelContext {
  registerTool(
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ): void | Promise<void>;
}
export function registerNewChatTool(stage: (phone: string) => void) {
  const context = (document as Document & { modelContext?: ModelContext }).modelContext;
  if (!context?.registerTool) return;
  const controller = new AbortController();
  try {
    void Promise.resolve(
      context.registerTool(
        {
          name: 'start_new_chat',
          title: 'Открыть новый чат',
          description:
            'Открывает форму нового чата. Не проверяет номер и не отправляет сообщения. Пользователь завершает действие в форме.',
          inputSchema: {
            type: 'object',
            properties: {
              phone: {
                type: 'string',
                description: 'Необязательный номер телефона для заполнения поля.',
              },
            },
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            if (!input || typeof input !== 'object' || Array.isArray(input))
              throw new Error('Ожидается объект с необязательным полем phone.');
            const values = input as Record<string, unknown>;
            if (
              Object.keys(values).some((key) => key !== 'phone') ||
              (values.phone !== undefined &&
                (typeof values.phone !== 'string' ||
                  values.phone.length > 30 ||
                  !/^[+\d\s()-]*$/.test(values.phone)))
            )
              throw new Error('Неверный формат номера телефона.');
            const phone = typeof values.phone === 'string' ? values.phone : '';
            stage(phone);
            return { status: 'form_opened', phone };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
  } catch {
    /* Обычный интерфейс работает и без экспериментального WebMCP. */
  }
  return () => controller.abort();
}
