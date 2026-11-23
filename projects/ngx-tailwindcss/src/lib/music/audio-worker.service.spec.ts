import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioWorkerService } from './audio-worker.service';

class MockWorker {
  postMessage = vi.fn();
  terminate = vi.fn();
  addEventListener = vi.fn();
}

describe('AudioWorkerService', () => {
  let service: AudioWorkerService;

  beforeEach(() => {
    vi.stubGlobal('Worker', MockWorker);
    // jsdom does not implement blob URLs
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    TestBed.configureTestingModule({ providers: [AudioWorkerService] });
    service = TestBed.inject(AudioWorkerService);
  });

  afterEach(() => {
    service.terminate();
    vi.unstubAllGlobals();
  });

  it('should keep pendingCount in sync when a request is dropped on queue overflow', async () => {
    service.configure({ maxPendingRequests: 2 });

    const first = service.smoothData({ data: [1] });
    const firstRejected = expect(first).rejects.toThrow('queue overflow');
    void service.smoothData({ data: [2] }).catch(() => undefined);
    void service.smoothData({ data: [3] }).catch(() => undefined);

    await firstRejected;
    expect(service.pendingCount()).toBe(2);
  });
});
