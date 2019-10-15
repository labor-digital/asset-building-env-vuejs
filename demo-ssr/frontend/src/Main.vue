<template>
	<h1 @click="onClick">Hello World :) test 123</h1>
</template>

<script lang="ts">
	export default {
		name: "Main",
		methods: {
			onClick() {
				console.log("clicked!");
			}
		}
	};
</script>

<style lang="sass">
	body
		background-color: green
		color: #fff
</style>