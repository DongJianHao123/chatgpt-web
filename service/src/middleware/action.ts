import axios from "axios";


export const JAVA_API = "https://admin.maodouketang.com:8443";

const user = {
	userId: "13900000000",
	username: "chatgpt4",
	role: "student",
	roomId: "100480101",
	client: "ChatGPT",
	title: "ChatGPT 使用心得分享",
}

const actionType = "CHATGPT"
export const setRoomAction = (payload: string) => {
	console.log("setRoomAction", user, actionType, payload);
	if (user.role === "subroom") user.role = "ta";
	if (!user.role) user.role === "student";
	const data = {
		userId: user.userId,
		userName: user.username,
		role: user.role,
		actionType: "CHATGPT",
		clientId: parseInt((user.roomId + "").substring(3, 6)) + "",
		clientName: user.client,
		courseId: (user.roomId + "").substring(6, 9),
		courseName: user.title,
		courseClassId: "0",
		courseClassName: user.title,
		roomId: `${user.roomId}`,
		actionTime: new Date().toISOString(),
		description: payload
	}
	axios.post(JAVA_API + "/analysis/api/room-actions", data).then((res) => {
		// console.log("action api res ==>", res);
	}).catch((error) => {
		console.error("action api err ==>", error);
	})
}
