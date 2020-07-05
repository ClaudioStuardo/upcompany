import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import styled from "styled-components";
import { getDisplayStream } from '../helpers/media-access';

import '../App.css';

import { ShareScreenIcon,MicOnIcon,MicOffIcon,CamOnIcon,CamOffIcon } from '../components/Icons';

const Container = styled.div`
    padding: 20px;
    display: flex;
    height: 100vh;
    width: 90%;
    margin: auto;
    flex-wrap: wrap;
`;

const StyledVideo = styled.video`
    height: 40%;
    width: 50%;
`;

const Video = (props) => {
    const ref = useRef();

    useEffect(() => {
        props.peer.on("stream", stream => {
            ref.current.srcObject = stream;
        })
    }, []);

    return (
        <StyledVideo playsInline autoPlay ref={ref} />
    );
}


const videoConstraints = {
    height: window.innerHeight / 2,
    width: window.innerWidth / 2
};

const Room = (props) => {
    const [peers, setPeers] = useState([]);
    const [peerAux, setPeerAux] = useState();
    const [payloadAux, setPayloadAux] = useState();
    const [localStream, setLocalStream] = useState({});
    const [localStreamAux, setLocalStreamAux] = useState({});
    const [userVideoAux, setUserVideoAux] = useState();
    const [streamUrl, setStreamUrl] = useState('');
    const [micState, setMicState] = useState('');
    const [camState, setCamState] = useState('');
    const socketRef = useRef();
    const userVideo = useRef();
    const peersRef = useRef([]);
    const roomID = props.match.params.roomID;

    useEffect(() => {
        socketRef.current = io.connect("https://videocallsclaudiostuardo.herokuapp.com/");
        navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true }).then(stream => {
            userVideo.current.srcObject = stream;
            setUserVideoAux(userVideo.current.srcObject);
            setLocalStream(stream);
            setLocalStreamAux(stream);
            socketRef.current.emit("join room", roomID);
            socketRef.current.on("all users", users => {
                const peers = [];
                users.forEach(userID => {
                    const peer = createPeer(userID, socketRef.current.id, userVideo.current.srcObject);
                    peersRef.current.push({
                        peerID: userID,
                        peer,
                    })
                    peers.push(peer);
                })
                setPeers(peers);
                setPeerAux(peers);
            })

            socketRef.current.on("user joined", payload => {
                const peer = addPeer(payload.signal, payload.callerID, userVideo.current.srcObject);
                peersRef.current.push({
                    peerID: payload.callerID,
                    peer,
                })
                setPeers(users => [...users, peer]);
                setPeerAux(users => [...users, peer]);
            });

            socketRef.current.on("receiving returned signal", payload => {
                const item = peersRef.current.find(p => p.peerID === payload.id);
                item.peer.signal(payload.signal);
            });
        })
    }, []);

    function createPeer(userToSignal, callerID, stream) {
        const peer = new Peer({
            initiator: true,
            trickle: false,
            stream,
        });

        peer.on("signal", signal => {
            socketRef.current.emit("sending signal", { userToSignal, callerID, signal })
        })

        return peer;
    }

    function addPeer(incomingSignal, callerID, stream) {
        const peer = new Peer({
            initiator: false,
            trickle: false,
            stream,
        })

        peer.on("signal", signal => {
            socketRef.current.emit("returning signal", { signal, callerID })
        })

        peer.signal(incomingSignal);

        return peer;
    }

    function getDisplay() {
        getDisplayStream().then(stream => {
            stream.oninactive = () => {
                getUserMedia().then(() => {
                    userVideo.current.srcObject = userVideoAux;
                });
            };
            if (peers.length<0) {
                peers[0].streams[0] = stream;
            }
            userVideo.current.srcObject = stream;
        });
    }

    function getUserMedia(cb) {
        return new Promise((resolve, reject) => {
            navigator.getUserMedia = navigator.getUserMedia =
                navigator.getUserMedia ||
                navigator.webkitGetUserMedia ||
                navigator.mozGetUserMedia;
            const op = {
                video: {
                    width: { min: 160, ideal: 640, max: 1280 },
                    height: { min: 120, ideal: 360, max: 720 }
                },
                audio: true
            };
            navigator.getUserMedia(
                op,
                stream => {
                    setLocalStream(stream);
                    setStreamUrl(stream);
                    resolve();
                },
                () => {}
            );
        });
    }

    function setAudioLocal(){
        if(localStream.getAudioTracks().length>0){
            localStream.getAudioTracks().forEach(track => {
                track.enabled=!track.enabled;
            });
        }
        setMicState(!micState);
      }
    
    function setVideoLocal(){
        if(localStream.getVideoTracks().length>0){
          localStream.getVideoTracks().forEach(track => {
            track.enabled=!track.enabled;
          });
        }
        setCamState(!camState);
      }

    return (
        <Container>
            <StyledVideo muted ref={userVideo} autoPlay playsInline />
            {peers.map((peer, index) => {
                return (
                    <Video 
                        key={index}
                        peer={peer}
                    />
                );
            })}
            
            <div className='controls'>
                <button
                    className='control-btn'
                    onClick={() => {
                        getDisplay();
                    }}
                >
                    <ShareScreenIcon />
                </button>
                <button
                    className='control-btn'
                    onClick={() => {
                        setAudioLocal();
                    }}
                >
                    {
                        !micState?(
                        <MicOnIcon/>
                        ):(
                        <MicOffIcon/>
                        )
                    }
                </button>
                <button
                    className='control-btn'
                    onClick={() => {
                        setVideoLocal();
                    }}
                >
                    {
                        !camState?(
                        <CamOnIcon/>
                        ):(
                        <CamOffIcon/>
                        )
                    }
                </button>
            </div>
        </Container>
    );
};

export default Room;