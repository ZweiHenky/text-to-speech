'use client'

import { useEffect, useState, useRef } from 'react'

export default function TextConverter() {
  const [text, setText] = useState('')
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState('')
  const [isConvertLoading, setIsConvertLoading] = useState(false)
  const [audioFiles, setAudioFiles] = useState([])
  const [selectedAudios, setSelectedAudios] = useState([])
  const [isCombining, setIsCombining] = useState(false)
  const audioContext = useRef(null)

  useEffect(() => {
    getVoices()
    audioContext.current = new (window.AudioContext || window.webkitAudioContext)()
  }, [])

  const getVoices = async () => {
    const url = 'https://api.cartesia.ai/voices'
    const options = {
      method: 'GET',
      headers: {
        'Cartesia-Version': '2024-06-10',
        'X-API-Key': '1d90ab17-fc05-4498-a634-08c5bd7f60ba'
      }
    }

    try {
      const response = await fetch(url, options)
      const data = await response.json()
      setVoices(data)
      if (data.length > 0) {
        setSelectedVoice(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching voices:', error)
      alert('No se pudieron cargar las voces disponibles')
    }
  }

  const textToVoice = async (voice, text) => {
    try {
      const response = await fetch("https://api.cartesia.ai/tts/bytes", {
        method: "POST",
        headers: {
          "X-API-Key": "1d90ab17-fc05-4498-a634-08c5bd7f60ba",
          "Cartesia-Version": "2024-06-10",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "model_id": "sonic-english",
          "transcript": text,
          "voice": {
            "mode": "id",
            "id": voice
          },
          "output_format": {
            "container": "mp3",
            "encoding": "mp3",
            "sample_rate": 44100
          }
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      return { url, size: blob.size }
    } catch (error) {
      console.error("Error in textToVoice:", error)
      throw error
    }
  }

  const handleTextToVoice = async () => {
    if (!text.trim()) {
      alert('Por favor, ingrese algún texto')
      return
    }
    if (!selectedVoice) {
      alert('Por favor, seleccione una voz')
      return
    }

    setIsConvertLoading(true)
    try {
      const result = await textToVoice(selectedVoice, text)
      if (result && result.url) {
        console.log("Datos de audio recibidos. Tamaño:", result.size)
        const audio = new Audio(result.url)
        audio.play()
        setAudioFiles(prev => [...prev, { url: result.url, name: `audio_${Date.now()}.mp3` }])
      } else {
        console.log("Respuesta inesperada:", result)
        alert('No se pudo generar el audio')
      }
    } catch (error) {
      console.error("Error al convertir texto a voz:", error)
      alert('Ocurrió un error al convertir el texto a voz')
    } finally {
      setIsConvertLoading(false)
    }
  }

  const toggleAudioSelection = (audioFile) => {
    setSelectedAudios(prev => 
      prev.includes(audioFile)
        ? prev.filter(a => a !== audioFile)
        : [...prev, audioFile]
    )
  }

  const combineAudios = async () => {
    if (selectedAudios.length < 2) {
      alert('Por favor, seleccione al menos dos audios para combinar')
      return
    }
  
    setIsCombining(true)
  
    try {
      const audioBuffers = await Promise.all(selectedAudios.map(async (file) => {
        const response = await fetch(file.url)
        const arrayBuffer = await response.arrayBuffer()
        return await audioContext.current.decodeAudioData(arrayBuffer)
      }))
  
      const gapDuration = 0.9 // 0.9 seconds gap
      const gapSamples = Math.round(gapDuration * audioContext.current.sampleRate)
  
      const totalSamples = audioBuffers.reduce((sum, buffer) => {
        return sum + buffer.length + gapSamples
      }, 0) - gapSamples // Subtract the last gap
  
      const combinedBuffer = audioContext.current.createBuffer(
        1,
        totalSamples,
        audioContext.current.sampleRate
      )
  
      const channelData = combinedBuffer.getChannelData(0)
  
      let offset = 0
      audioBuffers.forEach((buffer, index) => {
        channelData.set(buffer.getChannelData(0), offset)
        offset += buffer.length
  
        // Add gap after each audio except the last one
        if (index < audioBuffers.length - 1) {
          for (let i = 0; i < gapSamples; i++) {
            channelData[offset + i] = 0
          }
          offset += gapSamples
        }
      })
  
      const blob = await new Promise(resolve => {
        const mediaStreamSource = audioContext.current.createMediaStreamDestination()
        const sourceNode = audioContext.current.createBufferSource()
        sourceNode.buffer = combinedBuffer
        sourceNode.connect(mediaStreamSource)
        sourceNode.start(0)
  
        const mediaRecorder = new MediaRecorder(mediaStreamSource.stream)
        const chunks = []
  
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data)
        mediaRecorder.onstop = () => resolve(new Blob(chunks, { type: 'audio/mp3' }))
  
        mediaRecorder.start()
        sourceNode.onended = () => mediaRecorder.stop()
      })
  
      const url = URL.createObjectURL(blob)
      const newAudioFile = { url, name: `combined_audio_${Date.now()}.mp3` }
      setAudioFiles(prev => [...prev, newAudioFile])
      setSelectedAudios([])
  
      new Audio(url).play()
    } catch (error) {
      console.error('Error combining audios:', error)
      alert('Ocurrió un error al combinar los audios')
    } finally {
      setIsCombining(false)
    }
  }

  const deleteAudio = (audioToDelete) => {
    setAudioFiles(prev => prev.filter(audio => audio !== audioToDelete))
    setSelectedAudios(prev => prev.filter(audio => audio !== audioToDelete))
  }

  const playAudio = (audioUrl) => {
    new Audio(audioUrl).play()
  }

  const downloadAudio = (audioFile) => {
    const link = document.createElement('a')
    link.href = audioFile.url
    link.download = audioFile.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <textarea
        className="w-full p-2 border rounded mb-4 resize-y"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ingrese el texto aquí"
        rows={4}
      />
      <div className="mb-4">
        <select
          className="w-full p-2 border rounded"
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
        >
          <option value="">Seleccione una voz</option>
          {voices.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.name}
            </option>
          ))}
        </select>
      </div>
      <button 
        className={`w-full p-2 rounded text-white mb-4 ${isConvertLoading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
        onClick={handleTextToVoice}
        disabled={isConvertLoading}
      >
        {isConvertLoading ? 'Convirtiendo...' : 'Convertir'}
      </button>
      <h2 className="text-xl font-bold mb-2">Audios guardados:</h2>
      <ul className="space-y-2 mb-4">
        {audioFiles.map((file, index) => (
          <li key={index} className="flex items-center justify-between p-2 border rounded">
            <div className="flex items-center flex-grow">
              <input
                type="checkbox"
                checked={selectedAudios.includes(file)}
                onChange={() => toggleAudioSelection(file)}
                className="mr-2"
              />
              <span 
                className="cursor-pointer hover:text-blue-600 flex-grow"
                onClick={() => playAudio(file.url)}
              >
                {file.name}
              </span>
            </div>
            <div className="flex items-center">
              <button 
                onClick={() => downloadAudio(file)}
                className="mr-2 px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Descargar
              </button>
              <button 
                onClick={() => deleteAudio(file)}
                className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Borrar
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button 
        className={`w-full p-2 rounded text-white ${isCombining || selectedAudios.length < 2 ? 'bg-gray-400' : 'bg-purple-500 hover:bg-purple-600'}`}
        onClick={combineAudios}
        disabled={isCombining || selectedAudios.length < 2}
      >
        {isCombining ? 'Combinando...' : 'Combinar Audios Seleccionados'}
      </button>
    </div>
  )
}