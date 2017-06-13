
const async = require('async')
const fs = require('fs')
const path = require('path')
const readChunk = require('read-chunk')
const fileType = require('file-type')
const exec = require('child_process').exec
const ProgressBar = require('progress-bar')
const probe = require('node-ffprobe')



class FolderInformation {
	constructor() {
		this.folderData = {
			arrOfInputFolder: [], //Mảng chứa path của các folder input
			arrOfOutputFolder: [] //Mảng chứa path của các folder output
		}
    //khai báo fileData là đối tượng có 4 thuộc tính
		this.fileData = {
			arrOfInputFiles: [],  //Mảng chứa path của các file input
			arrOfInputFlacs: [],  //Mảng chứa path của các flac input
			arrOfOutputFiles: [], //Mảng chứa path của các file output
			arrOfOutputFlacs: []  //Mảng chứa path của các flac output
		}
	}

	getInputFolderAndFiles(srcPath) {
    // tạo mảng chứa các file và folder con của inputFolder
		let fileList = fs.readdirSync(srcPath),
			desPath = ''
		fileList.forEach((file) => { // lặp từng file trong fileList

			desPath = srcPath + '/' + file //desPath là đường dẫn của file và folder con

			if (fs.statSync(desPath).isDirectory()) { //nếu desPath là folder

				this.folderData.arrOfInputFolder.push(desPath) //thì đẩy vào mảng folder input

				this.getInputFolderAndFiles(desPath) //thực hiện đệ quy để lấy tất cả folder

			} else { //nếu không phải folder 
        
				let buffer = readChunk.sync(desPath, 0, 4100) //tạo biến đọc Magic Number

				if (fileType(buffer) && fileType(buffer).ext === 'flac') { //Nếu biến hỗ trợ dạng Magic Number và là Flac

					this.fileData.arrOfInputFlacs.push(desPath) //thì đẩy vào mảng file input

				} else {

					this.fileData.arrOfInputFiles.push(desPath) //các file còn lại đẩy vào mảng file input

				}
			}
		})
	}

  //phương thức lấy output file,folder và flac
	// tham số là inputFolder và outputFolder
	getOutputFolderAndFiles(sourceFolder, targetFolder) {

		this.folderData.arrOfInputFolder.forEach((data) => { // lặp từng data trong mảng arrOfInputFolder

			this.folderData.arrOfOutputFolder.push(targetFolder + '/' + data.substring(data.indexOf(path.basename(sourceFolder)))) // Đẩy từng data là outputFolder vào mảng arrOfOutputFolder
		})
		this.fileData.arrOfInputFiles.forEach((data) => { // lặp từng data trong mảng arrOfInputFiles
			
			this.fileData.arrOfOutputFiles.push(targetFolder + '/' + data.substring(data.indexOf(path.basename(sourceFolder)))) // Đẩy từng data là outputFiles vào mảng arrOfOutputFiles
		})
		this.fileData.arrOfInputFlacs.forEach((data) => { // lặp từng data trong mảng arrOfInputFlacs

			this.fileData.arrOfOutputFlacs.push(targetFolder + '/' + data.substring(data.indexOf(path.basename(sourceFolder)))) // Đẩy từng data là outputFlacs vào mảng arrOfOutputFlacs
		})
	}
}

class Converter {
	
	createOutputFolder(arrayOfOutputFolder, sourcePath, targetPath) { // hàm tạo folder ở ouput với cấu trúc giống input

		let outputFolder = path.basename(sourcePath), // lấy base name của thư mục đầu vào
			
			mkdir = exec(`cd "${targetPath}" && mkdir "${outputFolder}"`) // tạo thư mục ở đầu ra chứa tất cả các file và folder.
		
		async.mapSeries(arrayOfOutputFolder, (file, callback) => { // sử dụng vòng lặp mapSeries để tạo các folder con ở đầu ra một cách tuần tự

			if (!fs.existsSync(file)) {// kiểm tra xem ở đường dẫn có thư mục đó không
				
				let mkdirChild = exec(`cd "${path.dirname(file)}" && mkdir "${path.basename(file)}"`) // tạo child-process để cd tới đường dẫn trước đó (dirname) và tạo thư mục con theo basename
				
				mkdirChild.on('close', (code) => { // khi child-process kết thúc
					
					callback() // sau khi thực hiện xong một child-process thì callback để thực hiện tiếp child-process tiếp theo
				})
			}
		})
	}

	
	createOutputFiles(arrayOfInputFiles, arrayOfOutputFiles) { // hàm copy tất cả file (ko flac) ở thư mục đầu vào chuyển sang thưc mục đầu ra.
		if (arrayOfInputFiles.length === arrayOfOutputFiles.length) {
			for (let i = 0; i < arrayOfInputFiles.length; i++) {
				
				let cpChild = exec(`cp -rf "${arrayOfInputFiles[i]}" "${arrayOfOutputFiles[i]}"`) // thực hiện copy đè lên các file có sẵn ở đó nếu trùng tên.
			}
		} else {
			throw 'somethings seriously wrong '
		}

	}

	convert(bitRate, arrayOfInputFlacs, arrayOfOutputFlacs) { //eg: 128k
		if (arrayOfInputFlacs.length === arrayOfOutputFlacs.length) {
			
			async.mapSeries(arrayOfInputFlacs, (file, callback) => { // dùng async mapseries để lặp tuần tự

				//khởi tạo các thông tin cần thiết của file flac
				let flacSize = 1; //size của flac

				let flacBitrate = 1; // bitrate của flac

				// dùng node-ffprobe để lấy thông tin của file flac
				probe(file, function (err, probeData) {
					// gán biến khởi tạo ở trên với giá trị lấy được
					flacBitrate = probeData.format.bit_rate / 1000 // trả về bitrate k
					flacSize = probeData.format.size / 1024 // trả về dạng kb

					
					let totalMp3Size = flacSize * bitRate.replace(/[^0-9]/g, '') / flacBitrate //mp3Size = flacSize * mp3Bitrate / flacBitrate

					//Khởi tạo thanh progress-bar
					let bar = ProgressBar.create(process.stdout),
						mp3SizeWhenConverting = 0

					bar.format = '$bar;$percentage,3:0;% converted.';//pad percentage to a length of 3 with zeroes.
					bar.symbols.loaded = '\u2605';	// Black star
					bar.symbols.notLoaded = '\u2606';	// White star
					
					const advance = (curentMp3Size) => {
						// do stderr của ffmpeg chỉ đưa ra mp3SizeWhenConverting nhỏ hơn size thực 1 khoảng 3*bitrate
						// nên khi mp3SizeWhenConverting > total - 3*bitrate thì ta cho progress-bar chạy tới 100%
						if (mp3SizeWhenConverting > totalMp3Size - 3 * bitRate.replace(/[^0-9]/g, '')) {
							return bar.update(1); // return 100% nếu size > source

						} else if (!totalMp3Size) { // nếu totalMp3Size là null,undefied thì trả về progress-bar = 0%

							return bar.update(0); //return 0% nếu size = nan
						} else {
							
							bar.update(mp3SizeWhenConverting / totalMp3Size); // update % hiện tại
							
							mp3SizeWhenConverting = curentMp3Size // update size của pm3 hiện tại
						}
					}

					console.log(`Converting "${path.basename(file)}": `)

					let i = arrayOfInputFlacs.indexOf(file) // lấy index của file flac , để lấy ra cùng phần tử i trong mảng output
					// tạo child-process để convert flac
					let ffmpeg = exec(`ffmpeg -y -i "${file}" -ab ${bitRate} -map_metadata 0 -id3v2_version 3 "${arrayOfOutputFlacs[i].replace('.flac', '.mp3')}" `)

					ffmpeg.stdout.on('data', (data) => {
						console.log(data)
					})

					ffmpeg.stderr.on('data', (data) => {
						
						let curentMp3Size = data.substring(data.indexOf('size='), data.indexOf('time=')).replace(/[^0-9]/g, "") //lấy size mp3 hiện tại theo data cả process

						advance(curentMp3Size) // update vào progress-bar
					})

					ffmpeg.on('close', (code) => {

						console.log(` Done\n`) // khi hoàn thành thì log ra done

						callback()// callback để thực hiện child-process tiếp theo
					})
				});
			}, (err) => {
				if (err) {
					console.log('Errors Happened: ',err)
				} else {
					console.log('Completed!')
				}
			})

		} else {
			throw 'something wrong'
		}
	}
	convertFile(bitRate, inputFile, outputFile) {
		console.log(`Converting ${path.basename(inputFile)}`)
		let targetFile = outputFile + '/' + path.basename(inputFile).replace('.flac', '.mp3'),
			flacSize = 1,
			flacBitrate = 1

		probe(inputFile, function (err, probeData) {
			//gán thông tin của flac.
			flacBitrate = probeData.format.bit_rate / 1000 
			flacSize = probeData.format.size / 1024
			
			let totalMp3Size = flacSize * 128 / flacBitrate //khởi tạo biến có giá trị là kích thước file mp3 đầu ra

			//Khởi tạo progress-bar
			let bar = ProgressBar.create(process.stdout),
				mp3SizeWhenConverting = 0

			bar.format = '$bar;$percentage, 3:0;% converted.';// pad percentage to a length of 3 with zeroes.
			bar.symbols.loaded = '\u2605';	// Black star
			bar.symbols.notLoaded = '\u2606';	// White star

			const advance = (curentMp3Size) => {
				if (mp3SizeWhenConverting > totalMp3Size - 3 * bitRate.replace(/[^0-9]/g, '')) {
					return bar.update(1); // return 100% nếu size > source

				} else if (!totalMp3Size) {

					return bar.update(0); //return 0% nếu size = nan
				} else {
					bar.update(mp3SizeWhenConverting / totalMp3Size);
					mp3SizeWhenConverting = curentMp3Size
				}
			}

			//khởi tạo child-process để convert file flac sang mp3
			let ffmpeg = exec(`time ffmpeg -y -i "${inputFile}" -ab ${bitRate} -map_metadata 0 -id3v2_version 3 "${targetFile}"`)

			ffmpeg.stdout.on("data", data => {
				console.log(data)
			})
			ffmpeg.stderr.on("data", data => {
				
				let curentMp3Size = data.substring(data.indexOf('size='), data.indexOf('time=')).replace(/[^0-9]/g, "") //lấy size mp3 hiện tại theo data cả process

				advance(curentMp3Size) // update vào progress-bar
			})
			ffmpeg.on('close', (code) => {
				console.log(' Done\n')// close process-child
			})
		});
	}

}


let testSourceFolder = 'Adele'; // đường dẫn input folder
let testTargetFolder = 'fileCoppy'; // đường dẫn output folder

let testSourceFiles = 'Adele'; // đường dẫn input file
let testTargetFiles = 'fileCoppy'; // đường dẫn output file


let info = new FolderInformation()
info.getInputFolderAndFiles(testSourceFolder)
info.getOutputFolderAndFiles(testSourceFolder, testTargetFolder)


let converter = new Converter()
converter.createOutputFolder(info.folderData.arrOfOutputFolder, testSourceFolder, testTargetFolder)
converter.createOutputFiles(info.fileData.arrOfInputFiles, info.fileData.arrOfOutputFiles)
converter.convert('128k', info.fileData.arrOfInputFlacs, info.fileData.arrOfOutputFlacs)