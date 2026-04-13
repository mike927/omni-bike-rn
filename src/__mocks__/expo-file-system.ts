type MockFileRecord = {
  content: string;
  mimeType: string | null;
};

const files = new Map<string, MockFileRecord>();

function joinUri(parts: (string | { uri: string })[]): string {
  return parts
    .map((part) => (typeof part === 'string' ? part : part.uri))
    .join('/')
    .replace(/\/+/g, '/')
    .replace('file:/', 'file://');
}

export class File {
  readonly uri: string;
  readonly name: string;

  constructor(...uris: (string | { uri: string })[]) {
    this.uri = joinUri(uris);
    this.name = this.uri.split('/').pop() ?? 'file';
  }

  create(): void {
    if (!files.has(this.uri)) {
      files.set(this.uri, { content: '', mimeType: null });
    }
  }

  write(content: string | Uint8Array): void {
    const nextContent = typeof content === 'string' ? content : new TextDecoder().decode(content);
    const existing = files.get(this.uri);
    files.set(this.uri, {
      content: nextContent,
      mimeType: existing?.mimeType ?? null,
    });
  }

  delete(): void {
    files.delete(this.uri);
  }
}

export class Directory {
  readonly uri: string;

  constructor(...uris: (string | { uri: string })[]) {
    this.uri = joinUri(uris);
  }

  createFile(name: string, mimeType: string | null): File {
    const file = new File(this, name);
    files.set(file.uri, { content: '', mimeType });
    return file;
  }
}

export class Paths {
  static get cache(): Directory {
    return new Directory('file:///mock-cache');
  }
}

export const __expoFileSystemMock = {
  getFile(uri: string): MockFileRecord | undefined {
    return files.get(uri);
  },
  reset(): void {
    files.clear();
  },
};
