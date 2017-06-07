const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
const shell = require('shelljs');
// duong dan file flac
const dir = '/home/tu/Desktop/flac-to-mp3/Adele'; // '/home/tu/Desktop/flac-to-mp3/Adele'
//duong dan file mp3
const dir2 = '/home/tu/Desktop/flac-to-mp3/fileCoppy';

let arrayFlac = [];

// hàm tìm file flac trong thư mục và chuyển sang đuôi mp3
const getFiles = (srcDir, currentDir) => {
    let files = fs.readdirSync(srcDir);
    files.forEach((file) => {
        currentDir = srcDir + '/' + file
        if (fs.statSync(currentDir).isDirectory()) {
            getFiles(currentDir)
        } else if (kiemtraFlac(file)) { // nếu là file flac
            arrayFlac.push(currentDir) // nếu là file flac thì push vào mảng arrayFlac   
        }
    })
}
//hàm kiểm tra file flac
let kiemtraFlac = (file) => {
    return (path.extname(file) === '.flac');
}

function convertFile(newpath,arrayFlac,CurrentDir){ 
// console.log(newpath)
    arrayFlac.forEach((file,i) =>{
        // console.log(file)
        // let tempdir = outputFile.replace("/" + path.basename(outputFile),'')
        let targetFile = newpath + '/' + path.basename(file).replace('.flac', '.mp3')
        
        // console.log(targetFile)
        // shell.mkdir('-p',targetFile);
        
        let ffmpeg = exec(`ffmpeg -y -i "${arrayFlac[i]}" -ab 320 -map_metadata 0 -id3v2_version 3 "${targetFile}"`)
    })
}

console.time('thoi gian')
getFiles(dir)
convertFile(dir2,arrayFlac)
console.timeEnd('thoi gian')

