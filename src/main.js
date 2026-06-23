import './style.css'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import exifr from 'exifr'

document.querySelector('#app').innerHTML = `
  <div class="container">
    <h1>전국 방문지 기록</h1>

    <input type="file" id="photoInput" multiple accept="image/*">

<div class="stats">
  <div>등록 사진: <strong id="photoCount">0</strong>장</div>
  <div>방문 지역: <strong id="regionCount">0</strong>곳</div>
  <div>전국 방문률: <strong id="visitRate">0%</strong></div>
</div>

<h2>방문 지역</h2>
<ul id="regionList"></ul>

    <div id="map"></div>

    <h2>등록된 사진</h2>
    <ul id="photoList"></ul>
  </div>
`

const map = L.map('map').setView([36.5, 127.8], 7)

const photoIcon = L.divIcon({
  className: 'photo-marker',
  html: '📍',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
})

const photoList = document.getElementById('photoList')

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map)

async function getAddress(latitude, longitude) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ko`
  )

  const data = await response.json()
  const address = data.address || {}

  const province =
    address.province ||
    address.state ||
    ''

  const city =
    address.city ||
    address.town ||
    address.county ||
    address.municipality ||
    ''

  const district =
    address.borough ||
    address.suburb ||
    address.village ||
    ''

  return {
    province,
    city,
    district,
    displayName: [province, city, district].filter(Boolean).join(' ')
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      resolve(reader.result)
    }

    reader.onerror = () => {
      reject(reader.error)
    }

    reader.readAsDataURL(file)
  })
}

function updateStats() {
  const photoCount = document.getElementById('photoCount')
  const regionCount = document.getElementById('regionCount')
  const regionList = document.getElementById('regionList')
  const visitRate = document.getElementById('visitRate')

  photoCount.textContent = savedPhotos.length

  const regions = [...new Set(
    savedPhotos
      .map(photo => photo.address)
      .filter(Boolean)
  )]

  regionCount.textContent = regions.length

  const rate =
    ((regions.length / 229) * 100).toFixed(1)

  visitRate.textContent = `${rate}%`

  regionList.innerHTML = ''

  regions.forEach(region => {
    const listItem = document.createElement('li')
    listItem.textContent = region
    regionList.appendChild(listItem)
  })
}

function deletePhoto(index) {
  savedPhotos.splice(index, 1)

  localStorage.setItem(
    'visitedPhotos',
    JSON.stringify(savedPhotos)
  )

  location.reload()
}

const photoInput = document.getElementById('photoInput')

const savedPhotos =
  JSON.parse(localStorage.getItem('visitedPhotos')) || []

savedPhotos.forEach((photo, index) => {

  L.marker([
    photo.latitude,
    photo.longitude
  ], { icon: photoIcon })
  .addTo(map)
  .bindPopup(photo.name)

  const listItem = document.createElement('li')

listItem.innerHTML = `
  <div class="photo-card">
    ${photo.thumbnailUrl ? `<img src="${photo.thumbnailUrl}" alt="${photo.name}">` : ''}
    <div>
      <strong>${photo.name}</strong><br>
      ${photo.address || `${photo.latitude}, ${photo.longitude}`}<br>
      <button data-index="${index}">삭제</button>
    </div>
  </div>
`

listItem.querySelector('button').addEventListener('click', () => {
  deletePhoto(index)
})

photoList.appendChild(listItem)

})

updateStats()

photoInput.addEventListener('change', async (event) => {

  const files = event.target.files

  for (const file of files) {

    try {

      const gps = await exifr.gps(file)

      console.log(file.name)
      console.log(gps)

let address = { displayName: '' }

try {
  address = await getAddress(gps.latitude, gps.longitude)
  console.log(address)
} catch (error) {
  console.log('주소 변환 실패', error)
}

const imageUrl = URL.createObjectURL(file)
const thumbnailUrl = await fileToDataUrl(file)

L.marker([
  gps.latitude,
  gps.longitude
], { icon: photoIcon })
.addTo(map)
.bindPopup(`
  <div>
    <strong>${file.name}</strong><br>
    <img src="${imageUrl}" style="width:160px; margin-top:8px; border-radius:8px;">
  </div>
`)

map.setView([gps.latitude, gps.longitude], 13)

const listItem = document.createElement('li')

listItem.innerHTML = `
  <div class="photo-card">
    <img src="${thumbnailUrl}" alt="${file.name}">
    <div>
      <strong>${file.name}</strong><br>
      ${address.displayName || `${gps.latitude}, ${gps.longitude}`}
    </div>
  </div>
`

photoList.appendChild(listItem)

const alreadySaved = savedPhotos.some(photo =>
  photo.name === file.name &&
  photo.latitude === gps.latitude &&
  photo.longitude === gps.longitude
)

if (!alreadySaved) {
  savedPhotos.push({
  name: file.name,
  latitude: gps.latitude,
  longitude: gps.longitude,
  address: address.displayName,
  thumbnailUrl
})

  localStorage.setItem(
    'visitedPhotos',
    JSON.stringify(savedPhotos)
  )
  updateStats()
}

    } catch (error) {

alert(`${file.name} 사진의 GPS 정보를 읽지 못했어요. 위치 정보가 포함된 원본 사진인지 확인해 주세요.`)

console.log('GPS 없음', file.name)
console.log(error)
    }

  }

})