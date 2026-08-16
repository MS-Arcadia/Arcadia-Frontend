import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios"

import { http } from "@/services/http"

/**
 * An in-memory transport for `services/http.ts` tests.
 *
 * The mock adapter is kept out of the picture (the importing test no-ops it), so
 * what is under test is the interceptor stack itself: token attach, refresh,
 * idempotency keys, RFC 7807 mapping, toasts. A request lands in `calls` as a
 * pending promise the test settles with `respond`/`reject` — nothing here can
 * reach a network.
 */
export interface ScriptedCall {
  request: {
    method: string
    url: string
    headers: Record<string, unknown>
    params?: unknown
    data?: unknown
  }
  respond(response?: {
    status?: number
    data?: unknown
    headers?: Record<string, string>
  }): void
  reject(error: {
    status?: number
    reason?: string
    detail?: string
    field?: string
    code?: string
  }): void
}

export function useScriptedHttp(): ScriptedCall[] {
  const calls: ScriptedCall[] = []

  const adapter: AxiosAdapter = (config: InternalAxiosRequestConfig) =>
    new Promise<AxiosResponse>((resolve, reject) => {
      const call: ScriptedCall = {
        request: {
          method: (config.method ?? "get").toLowerCase(),
          url: `${config.baseURL ?? ""}${config.url ?? ""}`,
          headers: {
            ...(config.headers?.toJSON?.() ?? config.headers ?? {}),
          },
          params: config.params,
          data: config.data,
        },
        respond: ({
          status = 200,
          data = {},
          headers = {},
        } = {}) => {
          resolve({ status, statusText: String(status), data, headers, config })
        },
        reject: ({ status, reason, detail, field, code }) => {
          reject(
            status === undefined
              ? new AxiosError("Network Error", code, config)
              : new AxiosError(
                  "Request failed with status code " + status,
                  code,
                  config,
                  undefined,
                  {
                    status,
                    statusText: String(status),
                    data: {
                      ...(reason ? { reason } : {}),
                      ...(detail ? { detail } : {}),
                      ...(field ? { field } : {}),
                    },
                    headers: {},
                    config,
                  }
                )
          )
        },
      }
      calls.push(call)
    })

  http.defaults.adapter = adapter
  return calls
}

/** Wait until the adapter has seen `count` request(s). */
export async function waitForCalls(
  calls: ScriptedCall[],
  count: number
): Promise<void> {
  while (calls.length < count) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}
