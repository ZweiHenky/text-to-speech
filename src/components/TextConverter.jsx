'use client'

import { useEffect, useState, useRef } from 'react'
import { Mic, Download, Trash2, Play, Pause } from 'lucide-react'

export default function TextConverter() {
  const [text, setText] = useState('')
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState('')
  const [isConvertLoading, setIsConvertLoading] = useState(false)
  const [audioFiles, setAudioFiles] = useState([])
  const [isCombining, setIsCombining] = useState(false)
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null)
  const audioContext = useRef(null)
  const audioRef = useRef(new Audio())

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
        setAudioFiles(prev => [...prev, { url: result.url, name: `Audio_${prev.length + 1}` }])
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

  const combineAudios = async () => {
    if (audioFiles.length < 2) {
      alert('Por favor, genere al menos dos audios para combinar')
      return
    }
  
    setIsCombining(true)
  
    try {
      const audioBuffers = await Promise.all(audioFiles.map(async (file) => {
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
      const newAudioFile = { url, name: `Combinado_${audioFiles.length + 1}` }
      setAudioFiles(prev => [...prev, newAudioFile])
  
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
    if (currentlyPlaying === audioToDelete) {
      audioRef.current.pause()
      setCurrentlyPlaying(null)
    }
  }

  const togglePlayAudio = (audioFile) => {
    if (currentlyPlaying === audioFile) {
      audioRef.current.pause()
      setCurrentlyPlaying(null)
    } else {
      if (currentlyPlaying) {
        audioRef.current.pause()
      }
      audioRef.current = new Audio(audioFile.url)
      audioRef.current.play()
      setCurrentlyPlaying(audioFile)
    }
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
    <div className="container mx-auto px-4 py-8 max-w-md">
      <textarea
        className="w-full p-3 border rounded-lg mb-4 resize-y text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ingrese el texto aquí"
        rows={4}
      />
      <div className="mb-4">
        <select
          className="w-full p-3 border rounded-lg text-sm"
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
        className={`w-full p-3 rounded-lg text-white mb-6 flex items-center justify-center text-sm ${isConvertLoading ? 'bg-gray-400' : 'bg-blue-500 active:bg-blue-600'}`}
        onClick={handleTextToVoice}
        disabled={isConvertLoading}
      >
        <Mic className="mr-2" size={18} />
        {isConvertLoading ? 'Convirtiendo...' : 'Convertir'}
      </button>
      <h2 className="text-lg font-bold mb-3">Audios guardados:</h2>
      <ul className="space-y-3 mb-6">
        {audioFiles.map((file, index) => (
          <li key={index} className="bg-white shadow rounded-lg overflow-hidden">
            <div 
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => togglePlayAudio(file)}
            >
              <div className="flex items-center space-x-2 flex-grow">
                {currentlyPlaying === file ? (
                  <Pause size={18} className="text-blue-500" />
                ) : (
                  <Play size={18} className="text-gray-500" />
                )}
                <span className="text-xs truncate flex-grow">
                  {file.name}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadAudio(file);
                  }}
                  className="p-2 text-green-500 rounded-full hover:bg-green-100"
                  aria-label="Download"
                >
                  <Download size={18} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteAudio(file);
                  }}
                  className="p-2 text-red-500 rounded-full hover:bg-red-100"
                  aria-label="Delete"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <button 
        className={`w-full p-3 rounded-lg text-white text-sm ${isCombining || audioFiles.length < 2 ? 'bg-gray-400' : 'bg-purple-500 active:bg-purple-600'}`}
        onClick={combineAudios}
        disabled={isCombining || audioFiles.length < 2}
      >
        {isCombining ? 'Combinando...' : 'Combinar Audios'}
      </button>
    </div>
  )
}