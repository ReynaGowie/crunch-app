import React from 'react'
import { createRoot } from 'react-dom/client'
import CrunchApp from '../crunch_prototype'

const container = document.getElementById('root')!
const root = createRoot(container)
root.render(
  <React.StrictMode>
    <CrunchApp />
  </React.StrictMode>
)
