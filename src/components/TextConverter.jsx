'use client'

import { useState, useRef, useEffect } from 'react'
import { InfoIcon, Trash2, Download, Play, Pause } from 'lucide-react'

import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Textarea } from "../components/ui/textarea"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Slider } from "../components/ui/slider"



export default function Component() {
  const [participants, setParticipants] = useState(2)
  const [conversation, setConversation] = useState('')
  const [voices, setVoices] = useState([])
  const [selectedVoices, setSelectedVoices] = useState([])
  const [audioFiles, setAudioFiles] = useState([])
  const [isConvertLoading, setIsConvertLoading] = useState(false)
  const [isCombining, setIsCombining] = useState(false)
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const textareaRef = useRef(null)
  const audioRef = useRef(null)
  const audioContext = useRef(null)

  useEffect(() => {
    getVoices()
    audioContext.current = new (window.AudioContext || window.webkitAudioContext)()
  }, [])

  useEffect(() => {
    setSelectedVoices(Array(participants).fill(''))
  }, [participants])

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
    } catch (error) {
      console.error('Error fetching voices:', error)
      alert('No se pudieron cargar las voces disponibles')
    }
  }

  const handleParticipantsChange = (event) => {
    const value = parseInt(event.target.value)
    setParticipants(isNaN(value) ? 0 : Math.max(0, value))
  }

  const handleConversationChange = (event) => {
    setConversation(event.target.value)
  }

  const clearConversation = () => {
    setConversation('')
    setAudioFiles([])
  }

  const formatConversation = () => {
    if (textareaRef.current) {
      const lines = textareaRef.current.value.split('\n')
      const formattedLines = lines.map((line, index) => {
        const match = line.match(/^(\d+):/)
        if (!match) {
          const speakerNumber = (index % participants) + 1
          return `${speakerNumber}: ${line}`
        }
        return line
      })
      setConversation(formattedLines.join('\n'))
    }
  }

  const handleVoiceChange = (value, index) => {
    setSelectedVoices(prev => {
      const newVoices = [...prev]
      newVoices[index] = value
      return newVoices
    })
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

  const handleTextToVoiceConversion = async () => {
    const lines = conversation.split('\n')
    const newAudioFiles = []

    for (const line of lines) {
      const match = line.match(/^(\d+):(.*)/)
      if (match) {
        const [, speakerNumber, text] = match
        const speakerIndex = parseInt(speakerNumber) - 1
        const selectedVoice = selectedVoices[speakerIndex]

        if (!selectedVoice) {
          throw new Error(`Por favor, seleccione una voz para el participante ${speakerNumber}`)
        }

        const result = await textToVoice(selectedVoice, text.trim())
        if (result && result.url) {
          newAudioFiles.push({ url: result.url, name: `Audio_${speakerNumber}` })
        }
      }
    }

    return newAudioFiles
  }

  const handleTextToVoice = async () => {
    if (!conversation.trim()) {
      alert('Por favor, ingrese algún texto en la conversación')
      return
    }

    setIsConvertLoading(true)
    try {
      const newAudioFiles = await handleTextToVoiceConversion()
      setAudioFiles(newAudioFiles)
    } catch (error) {
      console.error("Error al convertir texto a voz:", error)
      alert(error instanceof Error ? error.message : 'Ocurrió un error al convertir el texto a voz')
    } finally {
      setIsConvertLoading(false)
    }
  }

  const combineAudios = async () => {
    if (conversation.trim() === '') {
      alert('Por favor, ingrese algún texto en la conversación')
      return
    }

    setIsCombining(true)

    try {
      let audiosToCombiné = audioFiles

      if (audioFiles.length === 0) {
        // Si no hay audios, primero convertimos el texto a voz
        const newAudioFiles = await handleTextToVoiceConversion()
        if (newAudioFiles.length === 0) {
          throw new Error('No se pudo convertir el texto a voz')
        }
        audiosToCombiné = newAudioFiles
      }

      if (audiosToCombiné.length < 2) {
        throw new Error('Se necesitan al menos dos audios para combinar')
      }

      const audioBuffers = await Promise.all(audiosToCombiné.map(async (file) => {
        const response = await fetch(file.url)
        const arrayBuffer = await response.arrayBuffer()
        return await audioContext.current.decodeAudioData(arrayBuffer)
      }))

      const gapDuration = 0.8 // 0.8 seconds gap
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
      const newAudioFile = { url, name: `Combinado_${audiosToCombiné.length}` }
      setAudioFiles([newAudioFile]) // Solo mostramos el archivo combinado
    } catch (error) {
      console.error('Error combining audios:', error)
      alert(error instanceof Error ? error.message : 'Ocurrió un error al combinar los audios')
    } finally {
      setIsCombining(false)
    }
  }

  const deleteAudio = (audioToDelete) => {
    setAudioFiles(prev => prev.filter(audio => audio !== audioToDelete))
    if (currentlyPlaying === audioToDelete) {
      audioRef.current?.pause()
      setCurrentlyPlaying(null)
    }
  }

  const togglePlayAudio = (audioFile) => {
    if (currentlyPlaying === audioFile) {
      audioRef.current?.pause()
      setCurrentlyPlaying(null)
    } else {
      if (currentlyPlaying) {
        audioRef.current?.pause()
      }
      audioRef.current = new Audio(audioFile.url)
      audioRef.current.playbackRate = playbackSpeed
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

  const handleSpeedChange = (value) => {
    const newSpeed = value[0]
    setPlaybackSpeed(newSpeed)
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.playbackRate = newSpeed
    }
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      )
    }
  }, [conversation])

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Conversación Grupal Avanzada con Conversión de Voz</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>Cómo usar</AlertTitle>
          <AlertDescription>
            Escribe cada línea de la conversación comenzando con el número de la persona que habla, seguido de dos puntos y un espacio. 
            Por ejemplo: &quot;1: Hola, ¿cómo están todos?&quot;. Si no incluyes un número, se asignará automáticamente.
          </AlertDescription>
        </Alert>
        <div className="space-y-2">
          <Label htmlFor="participants">Número de participantes</Label>
          <Input
            id="participants"
            type="number"
            min="0"
            value={participants}
            onChange={handleParticipantsChange}
          />
        </div>
        <div className="space-y-2">
          <Label>Selección de voces</Label>
          {Array.from({ length: participants }).map((_, index) => (
            <div key={index} className="flex items-center space-x-2">
              <span className="w-20">Persona {index + 1}:</span>
              <Select value={selectedVoices[index]} onValueChange={(value) => handleVoiceChange(value, index)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecciona una voz" />
                </SelectTrigger>
                <SelectContent>
                  {voices.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="conversation">Conversación</Label>
          <Textarea
            ref={textareaRef}
            id="conversation"
            placeholder="1: Hola, ¿cómo están todos?&#10;2: Muy bien, gracias. ¿Y tú?&#10;1: Excelente, gracias por preguntar."
            value={conversation}
            onChange={handleConversationChange}
            onBlur={formatConversation}
            rows={10}
          />
        </div>
        <div className="flex space-x-2">
          <Button onClick={handleTextToVoice} disabled={isConvertLoading}>
            {isConvertLoading ? 'Convirtiendo...' : 'Convertir a Voz'}
          </Button>
          <Button onClick={combineAudios} disabled={isCombining || conversation.trim() === ''}>
            {isCombining ? 'Procesando...' : 'Combinar y Convertir'}
          </Button>
        </div>
        {audioFiles.length > 0 && (
          <div className="space-y-2">
            <Label>Audios generados</Label>
            {audioFiles.map((audio, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Button variant="outline" size="icon" onClick={() =>togglePlayAudio(audio)}>
                  {currentlyPlaying === audio ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <span className="flex-grow">{audio.name}</span>
                <Button variant="outline" size="icon" onClick={() => downloadAudio(audio)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => deleteAudio(audio)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="playback-speed">Velocidad de reproducción: {playbackSpeed}x</Label>
          <Slider
            id="playback-speed"
            min={0.5}
            max={2}
            step={0.1}
            value={[playbackSpeed]}
            onValueChange={handleSpeedChange}
          />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div>
          {participants > 0 ? (
            <p className="text-sm text-muted-foreground">
              Participantes: {Array.from({ length: participants }, (_, i) => `Persona ${i + 1}`).join(', ')}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No hay participantes seleccionados</p>
          )}
        </div>
        <Button onClick={clearConversation}>Limpiar conversación</Button>
      </CardFooter>
    </Card>
  )
}