import { expect } from "vitest"

import { useScriptedHttp, waitForCalls, type ScriptedCall } from "./http"

/** Pass as `body` when the request should carry a multipart FormData. */
export const AS_FORM_DATA = Symbol("form-data")

/**
 * Fire one api-layer function and pin the request it produced: method, path,
 * params and body. The api layer is thin by design, and its failure mode is a
 * wrong path or a misnamed body field — invisible to TypeScript, fatal against
 * the gateway, and exactly what these assertions catch.
 */
export class EndpointScripter {
  readonly calls: ScriptedCall[]
  private next = 0

  constructor() {
    this.calls = useScriptedHttp()
  }

  async call(
    fire: () => Promise<unknown>,
    expected: {
      method: string
      url: string
      params?: unknown
      body?: unknown
    },
    response?: unknown
  ): Promise<unknown> {
    const pending = fire()
    await waitForCalls(this.calls, this.next + 1)
    const call = this.calls[this.next++]

    expect(call.request.method).toBe(expected.method)
    // Ends-with rather than equality: the axios baseURL is the environment's
    // business, the path is the api layer's.
    expect(
      call.request.url.endsWith(expected.url),
      `${call.request.url} should end with ${expected.url}`
    ).toBe(true)
    if (expected.params !== undefined) {
      expect(call.request.params).toEqual(expected.params)
    }
    if (expected.body === AS_FORM_DATA) {
      expect(call.request.data).toBeInstanceOf(FormData)
    } else if (expected.body !== undefined) {
      expect(JSON.parse(call.request.data as string)).toEqual(expected.body)
    }

    call.respond({ data: response ?? {} })
    return pending
  }
}
