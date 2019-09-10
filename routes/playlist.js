const express = require('express');
const router = express.Router();
const Modals = require('../dbModels/playlist.js');
const VideosModal = require("../dbModels/video.js");

router.get('/', async function (req, res) {
	res.render('playlist.ejs', { videoId: "myvid",user : req.user });
});

router.get('/getAll/:userID', async function (req, res) {   // API to get all playlists of a user
	try {
		let playlists = await Modals.playlist.find(
			{
				authorId: req.params.userID
			}
		);
		let obj = playlists;
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.write(JSON.stringify(obj));
		res.end();
	} catch (err) {
		if (err) throw err;
	}
});


router.get('/id/:pid', async function (req, res) {
	let pid = req.params.pid;
	try {
		let songs = await Modals.playlistContent.find(
			{
				playlistId: pid
			}
		);
		let songsWithExtraInfo = await VideosModal.dbVideo.populate(songs, { path: 'videoId', model: 'Video' });
		// console.log(songsWithExtraInfo+"::this is before sorting");
		songsWithExtraInfo.sort((a, b) => {
			//console.log(a+"::"+b);
			if (a.orderNum > b.orderNum) return 1;
			return -1;
		});
		//console.log(songsWithExtraInfo);
		res.render('play.ejs', { videos: songsWithExtraInfo });
	} catch (err) {
		throw err;
	}
});

router.get('/demo', async function (req, res) {
	try {
		let songs = await Modals.playlistContent.find(
			{
				playlistId: "5d7354acd476a21864141819"
			}
		);
		let songsWithExtraInfo = await VideosModal.dbVideo.populate(songs, { path: 'videoId', select: 'title', model: 'Video' });
		//let finalRes = await songsWithExtraInfo.sort('videoId');
		songsWithExtraInfo.sort((a, b) => {
			//console.log(a+"::"+b);
			if (a.videoId.title < b.videoId.title) return 1;
			return -1;
		});
		let i = 0;
		songsWithExtraInfo.forEach(async function (element) {
			element.orderNum = i;
			i = i + 1;
			await element.save();
		});
		res.send(songsWithExtraInfo + "</br></br>");

	} catch (err) {
		throw err;
	}

});

router.post('/createNew', async function (req, res) {    // API to add new playlist
	if (!req.body) {                                      // implement checking of playlist name already present
		res.status(400).send('Not a post request.');
	}
	if (!req.user) {
		res.status(401).send('Unauthorized access');
		res.end();
	} else {
		console.log(req.user);
		let nplay = new Modals.playlist({
			playlistName: req.body.name,
			authorId: req.user.email,
			videoCount: 1,
			privacy: req.body.privacy
		});
		let savedObj, pId;
		try {
			savedObj = await nplay.save();
			pId = savedObj._id;
			let ncontent = new Modals.playlistContent({
				videoId: req.body.videoId,
				playlistId: pId,
				orderNum: 1
			});
			savedObj = await ncontent.save();
		} catch (err) {
			console.log(err);
			res.status(400).send('Some error occured.');
		}
		let obj = {
			playlistId: pId,
			response: "Success"
		};
		res.writeHead(200, { 'Content-Type': 'application/json' })
		res.write(JSON.stringify(obj));
		res.end();
	}

	//  res.send(obj);
});

router.post('/addToPlaylist', async function (req, res) {   // API to add a video to a playlist
	// recieves object -> {
	//   videoId:videoSelected ,
	//   playlistId:element.value ,
	// }

	if (!req.body) res.end("error no req body");
	let videoC = 0;

	console.log("add request");
	try {
		let selectedPlaylist = await Modals.playlist.findById(req.body.playlistId);     // to find the videoCount
		if (selectedPlaylist) {
			let updatedPlaylist = await Modals.playlist.findByIdAndUpdate(req.body.playlistId,
				{ videoCount: selectedPlaylist.videoCount + 1 });
			let prevEntry = await Modals.playlistContent.findOne({
				videoId: req.body.videoId,
				playlistId: req.body.playlistId
			});
			if (!prevEntry) {         //if previous entry is not found i.e. search result is NULL
				let nEntry = new Modals.playlistContent({
					videoId: req.body.videoId,
					playlistId: req.body.playlistId,
					orderNum: selectedPlaylist.videoCount + 1
				});
				let savedObj = await nEntry.save();
				res.send("added succesfully");
			}
		}
	} catch (error) {
		res.send('some error occured');
		throw error;
	}



});

router.post('/removeFromPlaylist', async function (req, res) {  // API to delete a video from playlist
	// recieves object -> {
	//   videoId:videoSelected ,
	//   playlistId:element.value ,
	// }

	if (!req.body) res.end("no request body");
	console.log("delete req");
	Modals.playlistContent.deleteOne(
		{
			videoId: req.body.videoId,
			playlistId: req.body.playlistId
		},
		function (err) {
			if (err) throw err;
			console.log("delete success");
		}
	);
	res.send("deleted successfully");
});

router.post('/reorder', async function (req, res) {
	if (!req.body) res.end("no req body");
	try {
		let origin = req.body.origin;
		let dest = req.body.destination;
		let pid = req.body.playlistId;
		let change = origin - dest;
		if (change < 0) {
			let songs = await Modals.playlistContent.find({
				playlistId: pid,
				orderNum: { $gte: origin, $lte: dest }
			});
			songs.forEach(async function (song) {
				if (song.orderNum == origin) song.orderNum = dest;
				else song.orderNum = song.orderNum - 1;
				await song.save();
			});

		}
		else {
			let songs = await Modals.playlistContent.find({
				playlistId: pid,
				orderNum: { $gte: dest, $lte: origin }
			});
			songs.forEach(async function (song) {
				if (song.orderNum == origin) song.orderNum = dest;
				else song.orderNum = song.orderNum + 1;
				await song.save();
			});
		}
		let song = await Modals.playlistContent.findOne({
			playlistId: pid,
			orderNum: origin
		});
		res.send("ok");
	} catch (err) {
		throw err;
	}

});

router.post('/orderPlaylist', async function (req, res) {
	if (!req.body) res.end("no req body.");
	try {
		//console.log(req.body);
		let type = req.body.type;
		let order = req.body.order;
		let songs = await Modals.playlistContent.find(
			{
				playlistId: '5d7354acd476a21864141819'
			}
		);
		let temp;
		if (type == "alphabetical") temp = "title";
		else if (type == "dateuploaded") temp = "uploadTime";
		else temp = "views";
		let songsWithExtraInfo = await VideosModal.dbVideo.populate(songs, { path: 'videoId', model: 'Video' });
		// console.log(songs);
		songsWithExtraInfo.sort((a, b) => {
			//console.log(a+"::"+b);
			if ((order == "asc" && (a.videoId[temp] > b.videoId[temp])) || (order == "dsc" && (a.videoId[temp] < b.videoId[temp]))) return 1;
			return -1;
		});
		//console.log(songsWithExtraInfo);
		let i = 0;
		songsWithExtraInfo.forEach(async function (element) {
			element.orderNum = i;
			i = i + 1;
			await element.save();
		});
		res.send(songsWithExtraInfo + "</br></br>");

	} catch (err) {
		throw err;
	}
});

module.exports = router;