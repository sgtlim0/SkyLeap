import GameCanvas from './game/GameCanvas.tsx'
import styles from './App.module.css'

export default function App() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <GameCanvas />
      </div>
    </div>
  )
}
