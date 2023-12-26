<script setup lang='ts'>
import html2canvas from 'html2canvas'
import { NAutoComplete, NButton, NInput, NSelect, useDialog, useMessage } from 'naive-ui'
import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Message } from './components'
import HeaderComponent from './components/Header/index.vue'
import { useChat } from './hooks/useChat'
import { useScroll } from './hooks/useScroll'
import { useUsingContext } from './hooks/useUsingContext'
import { t } from '@/locales'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { HoverButton, SvgIcon } from '@/components/common'
import { fetchChatAPIProcess, getAllDocumentSets, getHunyuanChat, quryVectorDB } from '@/api'
import { useChatStore, usePromptStore } from '@/store'

let controller = new AbortController()

const openLongReply = import.meta.env.VITE_GLOB_OPEN_LONG_REPLY === 'true'

const route = useRoute()
const dialog = useDialog()
const ms = useMessage()

const chatStore = useChatStore()

const { isMobile } = useBasicLayout()
const { addChat, updateChat, updateChatSome } = useChat()
const { scrollRef, scrollToBottom, scrollToBottomIfAtBottom } = useScroll()
const { usingContext, toggleUsingContext } = useUsingContext()

const { uuid } = route.params as { uuid: string }

const dataSources = computed(() => chatStore.getChatByUuid(+uuid))
const conversationList = computed(() => dataSources.value.filter(item => (!item.inversion && !!item.conversationOptions)))

const prompt = ref<string>('')
const loading = ref<boolean>(false)
const inputRef = ref<Ref | null>(null)

const documentName = ref<string>()
const documentNames = ref<{ label: string; value: string }[]>()

// 添加PromptStore
const promptStore = usePromptStore()

// 使用storeToRefs，保证store修改后，联想部分能够重新渲染
const { promptList: promptTemplate } = storeToRefs<any>(promptStore)

// 未知原因刷新页面，loading 状态不会重置，手动重置
dataSources.value.forEach((item, index) => {
  if (item.loading)
    updateChatSome(+uuid, index, { loading: false })
})

const initDocumentNames = () => {
  getAllDocumentSets().then((res) => {
    const _res = res.data.map(item => ({ label: item.documentSetName.split('.')[0] ?? item.documentSetName, value: item.documentSetName }))
    _res.unshift({ label: '全部', value: 'all' })
    documentNames.value = _res
  })
}

function handleSubmit() {
  if (documentName.value) {
    quryVectorDB(prompt.value, documentName.value === 'all' ? '' : documentName.value, 5).then((res) => {
      onConversation(res.data.join('\n'))
    })
  }
  else {
    onConversation()
  }
}

const handleHunyuanAnswer = (responseText: string, message: string) => {
  let text = ''
  const answerArr = responseText.split('\n').map((item) => {
    try {
      const obj = JSON.parse(item)
      text += obj.Choices[0].Delta.Content
      return obj
    }
    catch (error) {
      return {}
    }
  })
  const lastOne = answerArr[answerArr.length - 1]
  let isItemLoading = true
  if (lastOne.Choices && lastOne.Choices[0].FinishReason === 'stop') {
    loading.value = false
    isItemLoading = false
  }

  updateChat(
    +uuid,
    dataSources.value.length - 1,
    {
      dateTime: new Date().toLocaleString(),
      text,
      inversion: false,
      error: false,
      loading: isItemLoading,
      requestOptions: { prompt: message, options: {} },
    },
  )

  scrollToBottomIfAtBottom()
}

const hunyuanSend = (question: string) => {
  getHunyuanChat(question, (event: any) => {
    const xhr = event.event.target
    const { responseText }: { responseText: string } = xhr
    handleHunyuanAnswer(responseText, question)
  }).catch(() => {
    const obj = { Choices: [{ FinishReason: 'stop', Delta: { Content: '网络好像出错了，请重试！' } }] }
    handleHunyuanAnswer(JSON.stringify(obj), question)
  })
}

async function onConversation(vectorData?: string) {
  const message = prompt.value

  if (loading.value)
    return

  if (!message || message.trim() === '')
    return

  controller = new AbortController()

  addChat(
    +uuid,
    {
      dateTime: new Date().toLocaleString(),
      text: message,
      inversion: true,
      error: false,
      conversationOptions: null,
      requestOptions: { prompt: message, options: null },
    },
  )
  scrollToBottom()

  loading.value = true
  prompt.value = ''

  let options: Chat.ConversationRequest = {}
  const lastContext = conversationList.value[conversationList.value.length - 1]?.conversationOptions

  if (lastContext && usingContext.value)
    options = { ...lastContext }

  addChat(
    +uuid,
    {
      dateTime: new Date().toLocaleString(),
      text: '',
      loading: true,
      inversion: false,
      error: false,
      conversationOptions: null,
      requestOptions: { prompt: message, options: { ...options } },
    },
  )
  scrollToBottom()

  const _message = vectorData ? `${vectorData}\n基于以上信息，回答如下问题，如果没有相关性，就忽略上面的信息，回答问题你也可以加一些你的理解或修饰。\n问题：\n${message}` : message

  try {
    hunyuanSend(_message)
  }
  catch (error) {

  }
}

//   try {
//     let lastText = ''
//     const fetchChatAPIOnce = async () => {
//       await fetchChatAPIProcess<Chat.ConversationResponse>({
//         prompt: message,
//         options,
//         signal: controller.signal,
//         onDownloadProgress: ({ event }) => {
//           const xhr = event.target
//           const { responseText } = xhr
//           // Always process the final line
//           const lastIndex = responseText.lastIndexOf('\n', responseText.length - 2)
//           let chunk = responseText
//           if (lastIndex !== -1)
//             chunk = responseText.substring(lastIndex)
//           try {
//             const data = JSON.parse(chunk)
//             updateChat(
//               +uuid,
//               dataSources.value.length - 1,
//               {
//                 dateTime: new Date().toLocaleString(),
//                 text: lastText + (data.text ?? ''),
//                 inversion: false,
//                 error: false,
//                 loading: true,
//                 conversationOptions: { conversationId: data.conversationId, parentMessageId: data.id },
//                 requestOptions: { prompt: message, options: { ...options } },
//               },
//             )

//             if (openLongReply && data.detail.choices[0].finish_reason === 'length') {
//               options.parentMessageId = data.id
//               lastText = data.text
//               message = ''
//               return fetchChatAPIOnce()
//             }

//             scrollToBottomIfAtBottom()
//           }
//           catch (error) {
//             //
//           }
//         },
//       })
//       updateChatSome(+uuid, dataSources.value.length - 1, { loading: false })
//     }

//     await fetchChatAPIOnce()
//   }
//   catch (error: any) {
//     const errorMessage = error?.message ?? t('common.wrong')

//     if (error.message === 'canceled') {
//       updateChatSome(
//         +uuid,
//         dataSources.value.length - 1,
//         {
//           loading: false,
//         },
//       )
//       scrollToBottomIfAtBottom()
//       return
//     }

//     const currentChat = getChatByUuidAndIndex(+uuid, dataSources.value.length - 1)

//     if (currentChat?.text && currentChat.text !== '') {
//       updateChatSome(
//         +uuid,
//         dataSources.value.length - 1,
//         {
//           text: `${currentChat.text}\n[${errorMessage}]`,
//           error: false,
//           loading: false,
//         },
//       )
//       return
//     }

//     updateChat(
//       +uuid,
//       dataSources.value.length - 1,
//       {
//         dateTime: new Date().toLocaleString(),
//         text: errorMessage,
//         inversion: false,
//         error: true,
//         loading: false,
//         conversationOptions: null,
//         requestOptions: { prompt: message, options: { ...options } },
//       },
//     )
//     scrollToBottomIfAtBottom()
//   }
//   finally {
//     loading.value = false
//   }
// }

async function onRegenerate(index: number) {
  if (loading.value)
    return

  controller = new AbortController()

  const { requestOptions } = dataSources.value[index]

  let message = requestOptions?.prompt ?? ''

  let options: Chat.ConversationRequest = {}

  if (requestOptions.options)
    options = { ...requestOptions.options }

  loading.value = true

  updateChat(
    +uuid,
    index,
    {
      dateTime: new Date().toLocaleString(),
      text: '',
      inversion: false,
      error: false,
      loading: true,
      conversationOptions: null,
      requestOptions: { prompt: message, options: { ...options } },
    },
  )

  try {
    let lastText = ''
    const fetchChatAPIOnce = async () => {
      await fetchChatAPIProcess<Chat.ConversationResponse>({
        prompt: message,
        options,
        signal: controller.signal,
        onDownloadProgress: ({ event }) => {
          const xhr = event.target
          const { responseText } = xhr
          // Always process the final line
          const lastIndex = responseText.lastIndexOf('\n', responseText.length - 2)
          let chunk = responseText
          if (lastIndex !== -1)
            chunk = responseText.substring(lastIndex)
          try {
            const data = JSON.parse(chunk)
            updateChat(
              +uuid,
              index,
              {
                dateTime: new Date().toLocaleString(),
                text: lastText + (data.text ?? ''),
                inversion: false,
                error: false,
                loading: true,
                conversationOptions: { conversationId: data.conversationId, parentMessageId: data.id },
                requestOptions: { prompt: message, options: { ...options } },
              },
            )

            if (openLongReply && data.detail.choices[0].finish_reason === 'length') {
              options.parentMessageId = data.id
              lastText = data.text
              message = ''
              return fetchChatAPIOnce()
            }
          }
          catch (error) {
            //
          }
        },
      })
      updateChatSome(+uuid, index, { loading: false })
    }
    await fetchChatAPIOnce()
  }
  catch (error: any) {
    if (error.message === 'canceled') {
      updateChatSome(
        +uuid,
        index,
        {
          loading: false,
        },
      )
      return
    }

    const errorMessage = error?.message ?? t('common.wrong')

    updateChat(
      +uuid,
      index,
      {
        dateTime: new Date().toLocaleString(),
        text: errorMessage,
        inversion: false,
        error: true,
        loading: false,
        conversationOptions: null,
        requestOptions: { prompt: message, options: { ...options } },
      },
    )
  }
  finally {
    loading.value = false
  }
}

function handleExport() {
  if (loading.value)
    return

  const d = dialog.warning({
    title: t('chat.exportImage'),
    content: t('chat.exportImageConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: async () => {
      try {
        d.loading = true
        const ele = document.getElementById('image-wrapper')
        const canvas = await html2canvas(ele as HTMLDivElement, {
          useCORS: true,
        })
        const imgUrl = canvas.toDataURL('image/png')
        const tempLink = document.createElement('a')
        tempLink.style.display = 'none'
        tempLink.href = imgUrl
        tempLink.setAttribute('download', 'chat-shot.png')
        if (typeof tempLink.download === 'undefined')
          tempLink.setAttribute('target', '_blank')

        document.body.appendChild(tempLink)
        tempLink.click()
        document.body.removeChild(tempLink)
        window.URL.revokeObjectURL(imgUrl)
        d.loading = false
        ms.success(t('chat.exportSuccess'))
        Promise.resolve()
      }
      catch (error: any) {
        ms.error(t('chat.exportFailed'))
      }
      finally {
        d.loading = false
      }
    },
  })
}

function handleDelete(index: number) {
  if (loading.value)
    return

  dialog.warning({
    title: t('chat.deleteMessage'),
    content: t('chat.deleteMessageConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      chatStore.deleteChatByUuid(+uuid, index)
    },
  })
}

function handleClear() {
  if (loading.value)
    return

  dialog.warning({
    title: t('chat.clearChat'),
    content: t('chat.clearChatConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      chatStore.clearChatByUuid(+uuid)
    },
  })
}

function handleEnter(event: KeyboardEvent) {
  if (!isMobile.value) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }
  else {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault()
      handleSubmit()
    }
  }
}

// function handleStop() {
//   if (loading.value) {
//     controller.abort()
//     loading.value = false
//   }
// }

// 可优化部分
// 搜索选项计算，这里使用value作为索引项，所以当出现重复value时渲染异常(多项同时出现选中效果)
// 理想状态下其实应该是key作为索引项,但官方的renderOption会出现问题，所以就需要value反renderLabel实现
const searchOptions = computed(() => {
  if (prompt.value.startsWith('/')) {
    return promptTemplate.value.filter((item: { key: string }) => item.key.toLowerCase().includes(prompt.value.substring(1).toLowerCase())).map((obj: { value: any }) => {
      return {
        label: obj.value,
        value: obj.value,
      }
    })
  }
  else {
    return []
  }
})

// value反渲染key
const renderOption = (option: { label: string }) => {
  for (const i of promptTemplate.value) {
    if (i.value === option.label)
      return [i.key]
  }
  return []
}

const placeholder = computed(() => {
  if (isMobile.value)
    return t('chat.placeholderMobile')
  return t('chat.placeholder')
})

const buttonDisabled = computed(() => {
  return loading.value || !prompt.value || prompt.value.trim() === ''
})

const footerClass = computed(() => {
  let classes = ['p-4']
  if (isMobile.value)
    classes = ['sticky', 'left-0', 'bottom-0', 'right-0', 'p-2', 'pr-3', 'overflow-hidden']
  return classes
})

onMounted(() => {
  scrollToBottom()
  if (inputRef.value && !isMobile.value)
    inputRef.value?.focus()
  initDocumentNames()
})

onUnmounted(() => {
  if (loading.value)
    controller.abort()
})
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <HeaderComponent v-if="isMobile" :using-context="usingContext" @export="handleExport" @handle-clear="handleClear" />
    <main class="flex-1 overflow-hidden">
      <div id="scrollRef" ref="scrollRef" style="position: relative;" class="h-full overflow-hidden overflow-y-auto">
        <div
          id="image-wrapper" class="w-full max-w-screen-xl m-auto dark:bg-[#101014]"
          :class="[isMobile ? 'p-2' : 'p-4']"
        >
          <template v-if="!dataSources.length">
            <div class="flex items-center justify-center mt-4 text-center text-neutral-300">
              <SvgIcon icon="ri:bubble-chart-fill" class="mr-2 text-3xl" />
              <span>Aha~</span>
            </div>
          </template>
          <template v-else>
            <div>
              <Message
                v-for="(item, index) of dataSources" :key="index" :date-time="item.dateTime" :text="item.text"
                :inversion="item.inversion" :error="item.error" :loading="item.loading" @regenerate="onRegenerate(index)"
                @delete="handleDelete(index)"
              />
              <!-- <div class="sticky bottom-0 left-0 flex justify-center">
                <NButton v-if="loading" type="warning" @click="handleStop">
                  <template #icon>
                    <SvgIcon icon="ri:stop-circle-line" />
                  </template>
                  {{ t('common.stopResponding') }}
                </NButton>
              </div> -->
            </div>
          </template>
        </div>
      </div>
    </main>
    <footer :class="footerClass">
      <div class="w-full max-w-screen-xl m-auto">
        <div class="flex items-center justify-between space-x-2">
          <HoverButton v-if="!isMobile" @click="handleClear">
            <span class="text-xl text-[#4f555e] dark:text-white">
              <SvgIcon icon="ri:delete-bin-line" />
            </span>
          </HoverButton>
          <HoverButton v-if="!isMobile" @click="handleExport">
            <span class="text-xl text-[#4f555e] dark:text-white">
              <SvgIcon icon="ri:download-2-line" />
            </span>
          </HoverButton>
          <HoverButton @click="toggleUsingContext">
            <span class="text-xl" :class="{ 'text-[#4b9e5f]': usingContext, 'text-[#a8071a]': !usingContext }">
              <SvgIcon icon="ri:chat-history-line" />
            </span>
          </HoverButton>
          <NSelect
            v-model:value="documentName" placeholder="未使用向量数据库" placement="top" :options="documentNames"
            clearable
          />
          <NAutoComplete v-model:value="prompt" :options="searchOptions" :render-label="renderOption">
            <template #default="{ handleInput, handleBlur, handleFocus }">
              <NInput
                ref="inputRef" v-model:value="prompt" type="textarea" :placeholder="placeholder"
                :autosize="{ minRows: 1, maxRows: isMobile ? 4 : 8 }" @input="handleInput" @focus="handleFocus"
                @blur="handleBlur" @keypress="handleEnter"
              />
            </template>
          </NAutoComplete>
          <NButton type="primary" :disabled="buttonDisabled" @click="handleSubmit">
            <template #icon>
              <span class="dark:text-black">
                <SvgIcon icon="ri:send-plane-fill" />
              </span>
            </template>
          </NButton>
        </div>
      </div>
    </footer>
  </div>
</template>

<style lang="less">
.n-select {
  width: 20%;
}
@media screen and (max-width: 767px) {
    .n-select {
      width: 60%; // 仅作为示例，为手机屏幕应用背景色
   }
}
</style>
