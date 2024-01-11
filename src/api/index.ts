import type { AxiosProgressEvent, GenericAbortSignal } from 'axios'
import axios from 'axios'
import { post } from '@/utils/request'
import { useAuthStore, useSettingStore } from '@/store'

export function fetchChatAPI<T = any>(
  prompt: string,
  options?: { conversationId?: string; parentMessageId?: string },
  signal?: GenericAbortSignal,
) {
  return post<T>({
    url: '/chat',
    data: { prompt, options },
    signal,
  })
}

export function fetchChatConfig<T = any>() {
  return post<T>({
    url: '/config',
  })
}

export function fetchChatAPIProcess<T = any>(
  params: {
    prompt: string
    options?: { conversationId?: string; parentMessageId?: string }
    signal?: GenericAbortSignal
    onDownloadProgress?: (progressEvent: AxiosProgressEvent) => void
  },
) {
  const settingStore = useSettingStore()
  const authStore = useAuthStore()

  let data: Record<string, any> = {
    prompt: params.prompt,
    options: params.options,
  }

  if (authStore.isChatGPTAPI) {
    data = {
      ...data,
      systemMessage: settingStore.systemMessage,
      temperature: settingStore.temperature,
      top_p: settingStore.top_p,
    }
  }

  return post<T>({
    url: '/chat-process',
    data,
    signal: params.signal,
    onDownloadProgress: params.onDownloadProgress,
  })
}

export function fetchSession<T>() {
  return post<T>({
    url: '/session',
  })
}

export function fetchVerify<T>(token: string) {
  return post<T>({
    url: '/verify',
    data: { token },
  })
}

export const getHunyuanChat = (question: string, onDownloadProgress: (progressEvent: AxiosProgressEvent) => void) => {
  return axios({
    method: 'post',
    url: 'http://101.200.208.215:8055/hunyuan/chat',
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      question,
    },
    onDownloadProgress,
  }).catch((err) => {
    throw err
  })
}

export const QueryType = {
  DOCUMENT_NAME: 1,
  INDEX: 2,
}

export const queryVectorDB = (content: string, fieldValue: string, limit = 3, queryType = QueryType.DOCUMENT_NAME) => {
  return axios<string[]>({
    method: 'post',
    url: '/vector-api/vector-db/query_text',
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      content,
      fieldValue,
      limit,
      queryType,
    },
  })
}

export const getAllDocumentSets = () => {
  return axios<vectorDB.DocumentSet[]>({
    method: 'get',
    url: '/vector-api/vector-db/get_all_files',
  })
}
