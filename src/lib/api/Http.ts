import { create } from "axios";
import type { AxiosInstance, AxiosRequestConfig } from "axios";

/** Shared transport: all browser/server HTTP requests go through this service. */
export class Http {
  private readonly client: AxiosInstance;
  constructor(baseURL: string, config: AxiosRequestConfig = {}) {
    this.client = create({
      baseURL,
      timeout: 20000,
      maxRedirects: 0,
      ...config,
    });
  }
  async get<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
    return (await this.client.get<T>(path, config)).data;
  }
  async post<T>(
    path: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return (await this.client.post<T>(path, body, config)).data;
  }
  async put<T>(
    path: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return (await this.client.put<T>(path, body, config)).data;
  }
}
export const http = new Http("/api/workspace",{timeout:300000});
